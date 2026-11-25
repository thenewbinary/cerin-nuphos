package ai.cerin.android

import android.app.Application
import ai.cerin.android.data.TokenStore
import ai.cerin.android.session.AuthSession
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class CerinApplication : Application() {
    lateinit var incomingShares: ai.cerin.android.session.IncomingShares
        private set
    lateinit var shareDraftStore: ai.cerin.android.data.ShareDraftStore
        private set
    val incomingShareScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.Main.immediate)

    val conversationLinks = ai.cerin.android.session.PendingConversationLink()
    lateinit var localNotifications: ai.cerin.android.notifications.LocalNotifications
        private set
    lateinit var tokenStore: TokenStore
        private set
    lateinit var authSession: AuthSession
        private set

    lateinit var pushNotifications: ai.cerin.android.notifications.PushNotifications
        private set

    private val appearancePreferences by lazy { getSharedPreferences("cerin.appearance", MODE_PRIVATE) }
    var botAvatarsEnabled by mutableStateOf(true)
        private set

    fun updateBotAvatars(enabled: Boolean) {
        botAvatarsEnabled = enabled
        appearancePreferences.edit().putBoolean("botAvatars", enabled).apply()
    }

    override fun onCreate() {
        super.onCreate()
        ai.cerin.android.ui.profile.reconcileAppIcon(this)
        botAvatarsEnabled = appearancePreferences.getBoolean("botAvatars", true)
        ai.cerin.android.model.Words.context = this
        getSharedPreferences("cerin.backend", MODE_PRIVATE).getString("origin", null)?.let {
            runCatching { ai.cerin.android.data.BackendOrigin.select(it) }
        }
        // One-time cleanup of the legacy process-local layout; it had no recoverable metadata.
        val legacyDraftText = ai.cerin.android.data.ComposerDraftPreferences(this)
        shareDraftStore = ai.cerin.android.data.ShareDraftStore(java.io.File(noBackupFilesDir, "share-drafts-v1"),
            discardLegacyText = legacyDraftText::erase)
        incomingShares = ai.cerin.android.session.IncomingShares(shareDraftStore,
            beforeLoad = { java.io.File(filesDir, "incoming-share-attachments").deleteRecursively() },
            onLegacyErased = { keys -> if (::authSession.isInitialized) authSession.composerDrafts.eraseMemory(keys) })
        tokenStore = TokenStore(this)
        authSession = AuthSession(this, tokenStore)
        localNotifications = ai.cerin.android.notifications.LocalNotifications(this, { authSession.user?.id }, { authSession.aiAllowed })
        pushNotifications = ai.cerin.android.notifications.PushNotifications(this)
        ai.cerin.android.session.AiAccess.onRevoked = { pushNotifications.reset(clearPending = false); incomingShares.identityReset() }
        authSession.onIdentityReset = {
            pushNotifications.reset()
            // An unfinished Archive Bot is the account's own business.
            ai.cerin.android.session.BotArchiveIssues.clearAll()
            incomingShares.identityReset()
            // Downloaded attachments must not outlive the account that could read them.
            cacheDir.listFiles { file -> file.name.startsWith("transfer-") }?.forEach { it.deleteRecursively() }
        }
        authSession.awaitIdentityCleanup = { incomingShares.awaitIdle() }
        authSession.beforeSessionEnd = { pushNotifications.awaitUnregistered() }
        registerActivityLifecycleCallbacks(pushNotifications)
    }
}
