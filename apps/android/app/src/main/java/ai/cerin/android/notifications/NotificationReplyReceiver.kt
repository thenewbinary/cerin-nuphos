package ai.cerin.android.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import ai.cerin.android.CerinApplication

/** The Reply action on a conversation notification. */
class NotificationReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(LocalNotifications.REPLY)?.toString()?.trim()
        val target = LocalNotificationTarget.from(
            intent.getStringExtra(LocalNotifications.ACCOUNT),
            intent.getStringExtra(LocalNotifications.TEAM),
            intent.getStringExtra(LocalNotifications.SESSION),
        )
        if (text.isNullOrEmpty() || target == null) return
        val pending = goAsync()
        (context.applicationContext as CerinApplication).pushNotifications.reply(target, text) { pending.finish() }
    }
}
