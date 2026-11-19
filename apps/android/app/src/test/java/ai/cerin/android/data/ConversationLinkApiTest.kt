package ai.cerin.android.data

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class ConversationLinkApiTest {
    @Test fun conversationAuthorizationDenialIsDistinctFromAnExpiredLogin() = runTest {
        var status = 403
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(status)
                .message("fixture").body("""{"error":{"message":"unavailable"}}""".toResponseBody(Http.jsonMedia)).build()
        }.build()
            for (code in listOf(403, 404)) {
                status = code
                try { CerinApi.conversationDetail(client, "synthetic", "507f1f77bcf86cd799439011", "fixture-chat"); fail() }
                catch (failure: CerinApi.Failure.Http) { assertEquals(code, failure.code) }
            }
            status = 401
            try { CerinApi.conversationDetail(client, "synthetic", "507f1f77bcf86cd799439011", "fixture-chat"); fail() }
            catch (_: CerinApi.Failure.Unauthorized) { }
    }
}
