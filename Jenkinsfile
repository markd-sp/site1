pipeline {
    agent any
    
    environment {
        // Conjur configuration
        CONJUR_URL = 'https://proxy:8443'
        CONJUR_ACCOUNT = 'myConjurAccount'
        CONJUR_LOGIN = 'host/jenkins-hosts/debian-1'
        
        // Secret paths in Conjur
        AWS_ACCESS_KEY_PATH = 'jenkins-app/aws/access-key-id'
        AWS_SECRET_KEY_PATH = 'jenkins-app/aws/secret-access-key'
        BUCKET_NAME_PATH = 'jenkins-app/aws/bucket-name'
        REGION_PATH = 'jenkins-app/aws/region'
    }
    
    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out code from Git...'
                checkout scm
            }
        }
        
stage('Authenticate to Conjur via REST API') {
    steps {
        script {
            echo 'Authenticating to Conjur using REST API...'
            withCredentials([string(credentialsId: 'conjur-api-key', variable: 'API_KEY')]) {
                // URL encode the login (host/name -> host%2Fname)
                def encodedLogin = CONJUR_LOGIN.replace('/', '%2F')
                
                // Pass API_KEY as environment variable, not interpolated
                def token = sh(
                    script: """
                        curl -k -X POST \
                          '${CONJUR_URL}/authn/${CONJUR_ACCOUNT}/${encodedLogin}/authenticate' \
                          -H 'Content-Type: text/plain' \
                          --data "\${API_KEY}" \
                          -w '\\n%{http_code}' \
                          -s
                    """,
                    returnStdout: true
                ).trim()
                
                // Split response and status code
                def lines = token.split('\n')
                def statusCode = lines[-1]
                def tokenValue = lines.size() > 1 ? lines[0..-2].join('\n') : ''
                
                echo "HTTP Status: ${statusCode}"
                
                if (statusCode == '200') {
                    env.CONJUR_TOKEN = tokenValue
                    echo '✓ Successfully authenticated to Conjur'
                } else {
                    error("Authentication failed with status code: ${statusCode}")
                }
            }
        }
    }
}
        
        stage('Retrieve AWS Credentials via REST API') {
            steps {
                script {
                    echo 'Retrieving AWS credentials from Conjur...'
                    
                    // REST API: Get AWS Access Key ID
                    env.AWS_ACCESS_KEY_ID = sh(
                        script: """
                            curl -k -X GET \
                              '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}' \
                              -H 'Authorization: Token token="${env.CONJUR_TOKEN}"' \
                              -s
                        """,
                        returnStdout: true
                    ).trim()
                    
                    // REST API: Get AWS Secret Access Key
                    env.AWS_SECRET_ACCESS_KEY = sh(
                        script: """
                            curl -k -X GET \
                              '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_SECRET_KEY_PATH}' \
                              -H 'Authorization: Token token="${env.CONJUR_TOKEN}"' \
                              -s
                        """,
                        returnStdout: true
                    ).trim()
                    
                    // REST API: Get S3 Bucket Name
                    env.S3_BUCKET = sh(
                        script: """
                            curl -k -X GET \
                              '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${BUCKET_NAME_PATH}' \
                              -H 'Authorization: Token token="${env.CONJUR_TOKEN}"' \
                              -s
                        """,
                        returnStdout: true
                    ).trim()
                    
                    // REST API: Get AWS Region
                    env.AWS_REGION = sh(
                        script: """
                            curl -k -X GET \
                              '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${REGION_PATH}' \
                              -H 'Authorization: Token token="${env.CONJUR_TOKEN}"' \
                              -s
                        """,
                        returnStdout: true
                    ).trim()
                    
                    echo '✓ Successfully retrieved all secrets via REST API'
                }
            }
        }
        
        stage('Verify AWS Connection') {
            steps {
                script {
                    echo 'Testing AWS connection...'
                    sh '''
                        export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
                        export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
                        export AWS_DEFAULT_REGION="${AWS_REGION}"
                        
                        aws sts get-caller-identity
                        aws s3 ls s3://${S3_BUCKET}
                    '''
                    echo '✓ AWS connection verified'
                }
            }
        }
        
        stage('Deploy to S3') {
            steps {
                script {
                    echo 'Deploying website to S3...'
                    sh '''
                        export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
                        export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
                        export AWS_DEFAULT_REGION="${AWS_REGION}"
                        
                        aws s3 sync . s3://${S3_BUCKET}/ \
                            --exclude ".git/*" \
                            --exclude "Jenkinsfile" \
                            --exclude "README.md" \
                            --delete
                        
                        echo "Website URL: http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
                    '''
                    echo '✓ Deployment complete'
                }
            }
        }
    }
    
    post {
        always {
            script {
                echo 'Cleaning up sensitive data...'
                env.CONJUR_TOKEN = ''
                env.AWS_ACCESS_KEY_ID = ''
                env.AWS_SECRET_ACCESS_KEY = ''
                env.S3_BUCKET = ''
                env.AWS_REGION = ''
            }
        }
        success {
            echo '🎉 Deployment succeeded!'
        }
        failure {
            echo '❌ Deployment failed'
        }
    }
}
