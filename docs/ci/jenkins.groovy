// Jenkinsfile (declarative pipeline)
// Runs Gauge and pushes per-step results (+ screenshots) to TestHub.
pipeline {
  agent any

  environment {
    TESTHUB_TOKEN   = credentials('testhub-token')      // Secret text credential
    TESTHUB_API_URL = 'https://testhub-one.vercel.app'
  }

  stages {
    stage('Gauge') {
      steps {
        sh 'gauge run --machine-readable specs | tee gauge.ndjson'
      }
    }
    stage('Send to TestHub') {
      steps {
        sh '''
          node scripts/gauge-ingest.mjs \
            --report gauge.ndjson \
            --token "$TESTHUB_TOKEN" \
            --run-name "Jenkins $BUILD_NUMBER" \
            --environment CI \
            --screenshots reports/html-report/images
        '''
      }
    }
  }
}
