package ai.cerin.android.ui

import androidx.compose.runtime.staticCompositionLocalOf
import ai.cerin.android.session.AgentStore
import ai.cerin.android.session.AuthSession
import ai.cerin.android.session.PlansStore

val LocalAuthSession = staticCompositionLocalOf<AuthSession> {
    error("AuthSession not provided")
}

val LocalAgentStore = staticCompositionLocalOf<AgentStore> {
    error("AgentStore not provided")
}

val LocalPlansStore = staticCompositionLocalOf<PlansStore> {
    error("PlansStore not provided")
}

val LocalConnectorsStore = staticCompositionLocalOf<ai.cerin.android.session.ConnectorsStore> {
    error("ConnectorsStore not provided")
}
