plugins { alias(libs.plugins.android.application) }
android {
    namespace = "ai.cerin.sharefixture"
    compileSdk = 37
    defaultConfig {
        val persistent = providers.gradleProperty("cerinIsolatedPersistentShareFixture").orNull == "true"
        applicationId = if (persistent) "ai.cerin.sharepersist1359.sender" else "ai.cerin.shareinput1355.sender"
        manifestPlaceholders["fixtureReceiver"] = if (persistent) "ai.cerin.android.sharepersist1359" else "ai.cerin.android.shareinput1355"
        manifestPlaceholders["fixtureAuthority"] = "$applicationId.files"
        minSdk = 33
        targetSdk = 36
        versionCode = 1
        versionName = "synthetic-1"
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
