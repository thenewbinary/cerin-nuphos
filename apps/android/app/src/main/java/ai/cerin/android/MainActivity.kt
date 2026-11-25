package ai.cerin.android

import android.content.Intent
import android.os.Bundle
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.currentCoroutineContext
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import ai.cerin.android.ui.CerinRoot
import ai.cerin.android.ui.theme.CerinTheme
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import okhttp3.OkHttpClient

class MainActivity : ComponentActivity() {
    private var handledConversationUrl: String? = null
    private var handledShare = false
    private val notificationPermission = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { }

    fun requestNotificationPermission() {
        val prefs = getPreferences(MODE_PRIVATE)
        if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED ||
            prefs.getBoolean("notification_permission_asked", false)) return
        prefs.edit().putBoolean("notification_permission_asked", true).apply()
        notificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
    }

    private val auth by lazy { (application as CerinApplication).authSession }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        handledShare = savedInstanceState?.getBoolean("handled_incoming_share") == true
        if (handledShare && ai.cerin.android.data.IncomingShareIntents.accepts(intent)) setIntent(Intent(this, MainActivity::class.java))
        handledConversationUrl = savedInstanceState?.getString("handled_conversation_url")
        if (handledConversationUrl != null && intent?.data?.toString() == handledConversationUrl) {
            setIntent(Intent(intent).also { it.data = null })
        }
        (application as CerinApplication).conversationLinks.restore(savedInstanceState?.getString("conversation_link"))
        SingletonImageLoader.setSafe { context ->
            ImageLoader.Builder(context)
                .components { add(OkHttpNetworkFetcherFactory(OkHttpClient())) }
                .crossfade(true)
                .build()
        }
        if (!handleShareIntent(intent)) handleAuthIntent(intent)
        setContent {
            CerinTheme {
                CerinRoot(auth)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!handleShareIntent(intent)) handleAuthIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean("handled_incoming_share", handledShare)
        outState.putString("handled_conversation_url", handledConversationUrl)
        outState.putString("conversation_link", (application as CerinApplication).conversationLinks.value.value?.destination?.url)
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        handleAuthIntent(intent)
        auth.onHostResumed()
    }

    private fun handleShareIntent(intent: Intent?): Boolean {
        if (!ai.cerin.android.data.IncomingShareIntents.accepts(intent)) return false
        handledShare = true
        val app = application as CerinApplication
        // Capture before clearing the Activity payload; the grant remains tied to the receiving Activity.
        val captured = Intent(requireNotNull(intent))
        setIntent(Intent(this, MainActivity::class.java))
        app.incomingShareScope.launch {
            val id = try { app.incomingShares.begin(app.authSession.user?.id) }
            catch (failure: Exception) {
                if (failure is kotlinx.coroutines.CancellationException) throw failure
                android.widget.Toast.makeText(this@MainActivity, getString(R.string.shell_share_unavailable), android.widget.Toast.LENGTH_LONG).show()
                return@launch
            }
            if (id == null) {
                android.widget.Toast.makeText(this@MainActivity, getString(R.string.shell_share_busy), android.widget.Toast.LENGTH_LONG).show()
                return@launch
            }
            val remaining = try { app.incomingShares.remainingBytes() }
            catch (failure: Exception) {
                if (failure is kotlinx.coroutines.CancellationException) throw failure
                app.incomingShares.failed(id, getString(R.string.shell_share_storage_check_failed))
                return@launch
            }
            var loaded = emptyList<ai.cerin.android.model.ComposerAttachment>()
            try {
                val payload = ai.cerin.android.data.IncomingShareIntents.read(captured)
                loaded = withContext(kotlinx.coroutines.Dispatchers.IO) {
                    val work = currentCoroutineContext()
                    fun checkCurrent() {
                        work.ensureActive()
                        if (app.incomingShares.state.value?.id != id) throw kotlinx.coroutines.CancellationException("Share canceled")
                    }
                    val inputs = payload.uris.map { checkCurrent(); ai.cerin.android.ui.chat.selectionInput(app, it, false) }
                    if (inputs.isEmpty()) emptyList() else {
                        val retained = ai.cerin.android.data.AttachmentRetention(app.shareDraftStore.assets, maxTotalBytes = remaining)
                            .retain(emptyList(), inputs, check = { checkCurrent() }, prepareImage = { input, bytes -> ai.cerin.android.ui.chat.loadImage(input, bytes) })
                        try { app.incomingShares.prepare(retained, check = { checkCurrent() }) }
                        catch (failure: Throwable) { retained.forEach { it.releaseOwnedCopy() }; throw failure }
                    }
                }
                app.incomingShares.loaded(id, payload.text, loaded)
            } catch (e: Exception) {
                withContext(kotlinx.coroutines.NonCancellable + kotlinx.coroutines.Dispatchers.IO) { loaded.forEach { it.releaseOwnedCopy() } }
                if (e is kotlinx.coroutines.CancellationException) throw e
                app.incomingShares.failed(id, getString(R.string.shell_share_read_failed))
            } finally {
                java.lang.ref.Reference.reachabilityFence(captured)
            }
        }
        return true
    }

    private fun handleAuthIntent(intent: Intent?) {
        if (intent != null && (application as CerinApplication).localNotifications.accept(intent)) {
            setIntent(Intent(intent).also { it.action = null; it.data = null; it.replaceExtras(null as Bundle?) })
            return
        }
        val data = intent?.data ?: return
        if (intent.action == Intent.ACTION_VIEW) {
            val destination = ai.cerin.android.session.ConversationLink.parseIncoming(data.toString())
            if (destination != null) {
                handledConversationUrl = data.toString()
                (application as CerinApplication).conversationLinks.offer(destination)
                setIntent(Intent(intent).also { it.data = null })
                return
            }
        }
        if (ai.cerin.android.session.ConnectorIntents.dispatch(data.toString()) || auth.handleCallback(data)) {
            setIntent(Intent(intent).also { it.data = null })
        }
    }
}
