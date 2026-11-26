package ai.cerin.android.ui.profile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AppIconUpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) reconcileAppIcon(context)
    }
}
