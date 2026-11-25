package ai.cerin.android.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/** Moves a conversation to another agent. Only its history moves; failures never retry. */
object ConversationRuntimeApi {
    private val client by lazy { Http.client.newBuilder().readTimeout(120, TimeUnit.SECONDS).callTimeout(120, TimeUnit.SECONDS).build() }
    suspend fun move(token: String, team: String, session: String, target: AgentRuntime): RuntimeBinding = withContext(Dispatchers.IO) {
        val url = CerinApi.baseUrl(token).toHttpUrl().newBuilder().addPathSegment("agent").addPathSegment("conversations")
            .addPathSegment(session).addPathSegment("runtime").addQueryParameter("teamId", team).build()
        // Older backends require `mode`.
        val body = JsonValue.obj("runtimeId" to JsonValue.Str(target.id), "mode" to JsonValue.Str("history"))
        val request = Request.Builder().url(url).header("Authorization", "Bearer $token")
            .header("Accept", "application/json").header("x-atlas-client", Http.clientHeader())
            .post(Http.json.encodeToString(JsonValue.serializer(), body).toRequestBody(Http.jsonMedia)).build()
        client.newCall(request).execute().use { response ->
            val text = response.body.string()
            if (response.code == 401) throw CerinApi.Failure.Unauthorized
            if (!response.isSuccessful) throw AgentChatApi.conflict(response.code, text)
            val value = JsonValue.parse(text) ?: throw CerinApi.Failure.InvalidResponse
            val id = value["runtimeId"]?.stringValue ?: throw CerinApi.Failure.InvalidResponse
            val provider = value["agentRuntime"]?.stringValue ?: throw CerinApi.Failure.InvalidResponse
            if (id != target.id) throw CerinApi.Failure.InvalidResponse
            RuntimeBinding(id, provider, value["runtimeLabel"]?.stringValue)
        }
    }
}
