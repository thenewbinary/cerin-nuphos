package ai.cerin.android.notifications

import ai.cerin.android.CerinApplication
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class CerinMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        (application as CerinApplication).pushNotifications.refreshed(token)
    }
    override fun onMessageReceived(message: RemoteMessage) {
        (application as CerinApplication).pushNotifications.receive(message.data)
    }
}
