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
                
                def token = sh(
                    script: """
                        curl -k -X POST \
                          '${CONJUR_URL}/authn/${CONJUR_ACCOUNT}/${encodedLogin}/authenticate' \
                          -H 'Content-Type: text/plain' \
                          --data "\${API_KEY}" \
                          -s
                    """,
                    returnStdout: true
                ).trim()
                
                // Remove any newlines or carriage returns
                token = token.replaceAll('\n', '').replaceAll('\r', '')
                
                if (token.isEmpty() || token.contains('error')) {
                    error("Authentication failed: ${token}")
                }
                
                env.CONJUR_TOKEN = token
                echo "✓ Successfully authenticated (token length: ${token.length()})"
            }
        }
    }
}

stage('Verify Token') {
    steps {
        script {
            echo "=== Token Verification ==="
            sh """
                echo "CONJUR_TOKEN is set: \${CONJUR_TOKEN:+yes}"
                echo "CONJUR_TOKEN length: \${#CONJUR_TOKEN}"
                echo "First 30 chars: \${CONJUR_TOKEN:0:30}"
            """
        }
    }
}

stage('Retrieve AWS Credentials via REST API') {
    steps {
        script {
            echo 'Retrieving AWS credentials from Conjur...'
            
            sh """
                # Function to retrieve secret
                get_secret() {
                    curl -k -s -X GET \
                      "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/\$1" \
                      -H "Authorization: Token token=${CONJUR_TOKEN}"
                }
                
                # Retrieve secrets
                get_secret "${AWS_ACCESS_KEY_PATH}" > /tmp/aws_ak.txt
                get_secret "${AWS_SECRET_KEY_PATH}" > /tmp/aws_sk.txt
                get_secret "${BUCKET_NAME_PATH}" > /tmp/bucket.txt
                get_secret "${REGION_PATH}" > /tmp/region.txt
            """
            
            env.AWS_ACCESS_KEY_ID = readFile('/tmp/aws_ak.txt').trim()
            env.AWS_SECRET_ACCESS_KEY = readFile('/tmp/aws_sk.txt').trim()
            env.S3_BUCKET = readFile('/tmp/bucket.txt').trim()
            env.AWS_REGION = readFile('/tmp/region.txt').trim()
            
//            sh 'rm -f /tmp/aws_ak.txt /tmp/aws_sk.txt /tmp/bucket.txt /tmp/region.txt'
            
            echo "✓ Retrieved AWS Access Key (length: ${env.AWS_ACCESS_KEY_ID.length()})"
            echo '✓ Successfully retrieved all secrets'
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
