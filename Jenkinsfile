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
                def encodedLogin = CONJUR_LOGIN.replace('/', '%2F')
                
                // Get token and save to file
                sh """
                    curl -k -X POST \
                      '${CONJUR_URL}/authn/${CONJUR_ACCOUNT}/${encodedLogin}/authenticate' \
                      -H 'Content-Type: text/plain' \
                      --data "\${API_KEY}" \
                      -s > /tmp/conjur_token.txt
                """
                
                // Read token from file
                env.CONJUR_TOKEN = readFile('/tmp/conjur_token.txt').trim()
                
                echo "✓ Successfully authenticated (token length: ${env.CONJUR_TOKEN.length()})"
            }
        }
    }
}

stage('Test All Token Formats') {
    steps {
        script {
            sh """
                TOKEN="${CONJUR_TOKEN}"
                
                echo "=== Testing different authorization formats ==="
                
                echo "Format 1: Token token=XXX"
                curl -k -w "\\nStatus: %{http_code}\\n" -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}" \
                  -H "Authorization: Token token=\${TOKEN}" \
                  -s
                
                echo "---"
                echo "Format 2: Token: XXX"
                curl -k -w "\\nStatus: %{http_code}\\n" -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}" \
                  -H "Authorization: Token \${TOKEN}" \
                  -s
                
                echo "---"
                echo "Format 3: Bearer XXX"
                curl -k -w "\\nStatus: %{http_code}\\n" -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}" \
                  -H "Authorization: Bearer \${TOKEN}" \
                  -s
            """
        }
    }
}

stage('Retrieve AWS Credentials via REST API') {
    steps {
        script {
            echo 'Retrieving AWS credentials from Conjur...'
            
            sh """
                # Try WITHOUT base64 encoding first
                TOKEN="${CONJUR_TOKEN}"
                
                echo "Attempt 1: Token as-is"
                RESPONSE=\$(curl -k -w "\\nHTTP_CODE:%{http_code}" -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}" \
                  -H "Authorization: Token token=\${TOKEN}" \
                  -s)
                
                echo "\$RESPONSE"
                
                if echo "\$RESPONSE" | grep -q "HTTP_CODE:401"; then
                    echo "Attempt 2: Trying with base64 encoded token"
                    TOKEN_B64=\$(echo -n "${CONJUR_TOKEN}" | base64)
                    curl -k -X GET \
                      "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}" \
                      -H "Authorization: Token token=\${TOKEN_B64}" \
                      -s > /tmp/aws_access_key.txt
                else
                    echo "\$RESPONSE" | sed 's/HTTP_CODE:.*//' > /tmp/aws_access_key.txt
                fi
            """
            
            env.AWS_ACCESS_KEY_ID = readFile('/tmp/aws_access_key.txt').trim()
            echo "Retrieved: ${env.AWS_ACCESS_KEY_ID.take(10)}..."
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
