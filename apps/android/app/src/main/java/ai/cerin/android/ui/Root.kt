package ai.cerin.android.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import ai.cerin.android.ui.profile.ConsentScreen
import ai.cerin.android.ui.profile.ConsentRecoveryScreen
import ai.cerin.android.data.AccountApi
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import ai.cerin.android.data.ConnectorApi
import ai.cerin.android.data.ConnectorPendingPreferences
import ai.cerin.android.session.ConnectorsStore
import ai.cerin.android.model.CerinUser
import ai.cerin.android.session.AiAccess
import ai.cerin.android.session.AgentStore
import ai.cerin.android.session.AuthSession
import ai.cerin.android.session.PlansStore
import ai.cerin.android.ui.home.HomeRoute
import ai.cerin.android.ui.login.LoginScreen
import ai.cerin.android.ui.login.SplashScreen

@Composable
fun CerinRoot(auth: AuthSession) {
    LaunchedEffect(Unit) { auth.restore() }
    val app = LocalContext.current.applicationContext as ai.cerin.android.CerinApplication
    val notifications = app.localNotifications
    val host = androidx.activity.compose.LocalActivity.current as? ai.cerin.android.MainActivity
    LaunchedEffect(auth.state, auth.aiAllowed) {
        if (auth.state !is AuthSession.State.Restoring)
            app.pushNotifications.sync(auth.user?.id, auth.token, auth.aiAllowed)
        notifications.onIdentity(auth.user?.id, auth.state is AuthSession.State.SignedOut)
        auth.user?.id?.let { app.incomingShares.bindAccount(it) }
        if (auth.state is AuthSession.State.SignedIn && auth.aiAllowed) host?.requestNotificationPermission()
    }
    CompositionLocalProvider(LocalAuthSession provides auth) {
        // A request that needs a recent code waits on this dialog (data/StepUp.kt).
        StepUpDialogHost()
        Surface(Modifier.fillMaxSize()) {
            val destination = when (auth.state) {
                AuthSession.State.Restoring -> "restoring"
                is AuthSession.State.SignedOut, AuthSession.State.SigningIn -> "login"
                is AuthSession.State.SignedIn -> when {
                    auth.aiAllowed -> "home"
                    auth.consentBusy && auth.consentVersion == null -> "restoring"
                    auth.consentVersion == AccountApi.AI_CONSENT_VERSION -> "consent"
                    else -> "consent-recovery"
                }
            }
            AnimatedContent(
                targetState = destination,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "auth",
            ) { key ->
                if (key != destination) SplashScreen() else when (key) {
                    "restoring" -> SplashScreen()
                    "login" -> LoginScreen()
                    else -> {
                        val user = (auth.state as? AuthSession.State.SignedIn)?.user
                        if (user != null && key == "home" && auth.aiAllowed) SignedInHost(user, auth.token.orEmpty())
                        // Outgoing Home must never turn into a consent form during the fade.
                        else if (user != null && key == "consent" && auth.consentVersion == AccountApi.AI_CONSENT_VERSION) ConsentScreen(user)
                        else if (user != null && key == "consent-recovery") ConsentRecoveryScreen(user)
                        else if (user != null) SplashScreen()
                        else LoginScreen()
                    }
                }
            }
        }
    }
}

@Composable
internal fun SignedInHost(user: CerinUser, token: String, agentFactory: (String, android.content.Context) -> AgentStore = ::AgentStore) {
    val context = LocalContext.current.applicationContext
    val agent = remember(token, AiAccess.revision) { agentFactory(token, context) }
    LaunchedEffect(agent.teamsPhase, agent.teams) {
        if (agent.teamsPhase == AgentStore.Phase.Loaded && AiAccess.bind(token)()) kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main.immediate) {
            (context as ai.cerin.android.CerinApplication).incomingShares.pruneTeams(user.id, agent.teams.map { it.id }.toSet())
        }
    }
    val plans = remember(token) { PlansStore(token) }
    val connectors = remember(token, user.id) { ConnectorsStore(ConnectorApi(token), ConnectorPendingPreferences(context, user.id)) }
    HomeRoute(user, agent, plans, connectors)
}
