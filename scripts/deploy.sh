#!/bin/bash

###############################################################################
# DevPulse Kubernetes Deployment Automation Script (Phase 10)
# Purpose: Automated end-to-end deployment with monitoring and verification
# Usage: ./deploy.sh [dev|staging|prod] [install|upgrade|rollback]
###############################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-prod}"
ACTION="${2:-install}"
TIMESTAMP=$(date +%s)
LOG_FILE="${SCRIPT_DIR}/deployment-${ENVIRONMENT}-${TIMESTAMP}.log"

###############################################################################
# Logging Functions
###############################################################################

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}✓ $*${NC}" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}✗ $*${NC}" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $*${NC}" | tee -a "${LOG_FILE}"
}

###############################################################################
# Validation Functions
###############################################################################

check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    for tool in kubectl helm jq; do
        if ! command -v "${tool}" &> /dev/null; then
            missing_tools+=("${tool}")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    log_success "All prerequisites installed"
    return 0
}

validate_environment() {
    log "Validating environment: ${ENVIRONMENT}"
    
    if [[ ! "${ENVIRONMENT}" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: ${ENVIRONMENT}"
        return 1
    fi
    
    local values_file="${SCRIPT_DIR}/helm/values-${ENVIRONMENT}.yaml"
    if [ ! -f "${values_file}" ]; then
        log_error "Values file not found: ${values_file}"
        return 1
    fi
    
    log_success "Environment validated: ${ENVIRONMENT}"
    return 0
}

check_cluster_connectivity() {
    log "Checking Kubernetes cluster connectivity..."
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    local nodes=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')
    log_success "Connected to cluster. Nodes: ${nodes}"
    return 0
}

###############################################################################
# Namespace & Secret Management
###############################################################################

setup_namespace() {
    local namespace="devpulse"
    
    if [[ "${ENVIRONMENT}" != "prod" ]]; then
        namespace="devpulse-${ENVIRONMENT}"
    fi
    
    log "Setting up namespace: ${namespace}"
    
    if kubectl get namespace "${namespace}" &> /dev/null; then
        log_warning "Namespace already exists: ${namespace}"
    else
        kubectl create namespace "${namespace}"
        kubectl label namespace "${namespace}" environment="${ENVIRONMENT}"
        log_success "Namespace created: ${namespace}"
    fi
    
    echo "${namespace}"
}

create_secrets() {
    local namespace=$1
    
    log "Creating secrets in namespace: ${namespace}"
    
    # Generate passwords if they don't exist
    local db_password=${DB_PASSWORD:-$(openssl rand -base64 32)}
    local redis_password=${REDIS_PASSWORD:-$(openssl rand -base64 32)}
    local jwt_secret=${JWT_SECRET:-$(openssl rand -base64 64)}
    local api_key=${API_KEY:-$(uuidgen)}
    local encryption_secret=${ENCRYPTION_SECRET:-$(openssl rand -base64 48)}
    
    # Create main secrets
    kubectl create secret generic devpulse-secrets \
        --namespace="${namespace}" \
        --from-literal=DATABASE_URL="postgresql://postgres:${db_password}@devpulse-db.${namespace}.svc.cluster.local:5432/devpulse" \
        --from-literal=REDIS_URL="redis://:${redis_password}@devpulse-redis.${namespace}.svc.cluster.local:6379" \
        --from-literal=JWT_SECRET="${jwt_secret}" \
        --from-literal=API_KEY="${api_key}" \
        --from-literal=ENCRYPTION_SECRET="${encryption_secret}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create database credentials
    kubectl create secret generic db-credentials \
        --namespace="${namespace}" \
        --from-literal=username=postgres \
        --from-literal=password="${db_password}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create Redis credentials
    kubectl create secret generic redis-credentials \
        --namespace="${namespace}" \
        --from-literal=password="${redis_password}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Secrets created in namespace: ${namespace}"
}

###############################################################################
# Helm Deployment Functions
###############################################################################

add_helm_repos() {
    log "Adding Helm repositories..."
    
    helm repo add devpulse https://charts.devpulse.io 2>/dev/null || true
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
    helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
    
    helm repo update
    
    log_success "Helm repositories updated"
}

deploy_helm_chart() {
    local namespace=$1
    local values_file="${SCRIPT_DIR}/helm/values-${ENVIRONMENT}.yaml"
    local release_name="devpulse"
    
    if [[ "${ENVIRONMENT}" != "prod" ]]; then
        release_name="devpulse-${ENVIRONMENT}"
    fi
    
    log "Deploying Helm chart: ${release_name} (${ACTION})"
    
    local helm_cmd="helm ${ACTION} ${release_name} \
        devpulse/devpulse \
        --namespace ${namespace} \
        --create-namespace \
        --values ${values_file} \
        --timeout 15m \
        --wait"
    
    if [[ "${ACTION}" == "upgrade" ]]; then
        helm_cmd="${helm_cmd} --atomic"
    fi
    
    if eval "${helm_cmd}"; then
        log_success "Helm deployment successful"
    else
        log_error "Helm deployment failed"
        return 1
    fi
}

###############################################################################
# Database Initialization
###############################################################################

wait_for_database() {
    local namespace=$1
    local pod="devpulse-db-0"
    local timeout=300
    local elapsed=0
    
    log "Waiting for database pod to be ready (${pod})..."
    
    while [ ${elapsed} -lt ${timeout} ]; do
        if kubectl wait pod \
            --selector="app=devpulse-db" \
            --for condition=Ready \
            --timeout=10s \
            -n "${namespace}" &>/dev/null; then
            log_success "Database pod is ready"
            return 0
        fi
        
        elapsed=$((elapsed + 10))
        echo -n "."
    done
    
    log_error "Database pod not ready after ${timeout}s"
    return 1
}

initialize_database() {
    local namespace=$1
    
    log "Initializing database..."
    
    # Wait for database to be ready
    if ! wait_for_database "${namespace}"; then
        return 1
    fi
    
    # Run migrations
    log "Running database migrations..."
    
    kubectl run devpulse-migrate \
        --image=devpulse-migrations:latest \
        --restart=Never \
        --rm \
        -i \
        --namespace "${namespace}" \
        -- npm run migrate
    
    log_success "Database initialization complete"
}

###############################################################################
# Monitoring Setup
###############################################################################

setup_monitoring() {
    local namespace=$1
    
    log "Setting up monitoring..."
    
    # Create ServiceMonitor
    kubectl apply -f - << EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: devpulse
  namespace: ${namespace}
spec:
  selector:
    matchLabels:
      app: devpulse-app
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
EOF
    
    log_success "Monitoring configured"
}

###############################################################################
# Health Checks & Verification
###############################################################################

verify_deployment() {
    local namespace=$1
    
    log "Verifying deployment..."
    
    # Check deployment status
    local replicas=$(kubectl get deployment -n "${namespace}" \
        -o jsonpath='{.items[0].status.replicas}')
    local ready=$(kubectl get deployment -n "${namespace}" \
        -o jsonpath='{.items[0].status.readyReplicas}')
    
    log "Deployment status: ${ready}/${replicas} replicas ready"
    
    if [ "${ready}" != "${replicas}" ]; then
        log_warning "Not all replicas are ready yet"
    fi
    
    # Check database
    if kubectl get statefulset -n "${namespace}" devpulse-db &>/dev/null; then
        local db_ready=$(kubectl get statefulset -n "${namespace}" devpulse-db \
            -o jsonpath='{.status.readyReplicas}')
        log "Database status: ${db_ready} replicas ready"
    fi
    
    # Check Redis
    if kubectl get statefulset -n "${namespace}" devpulse-redis &>/dev/null; then
        local redis_ready=$(kubectl get statefulset -n "${namespace}" devpulse-redis \
            -o jsonpath='{.status.readyReplicas}')
        log "Redis status: ${redis_ready} replicas ready"
    fi
    
    # Test health endpoint
    log "Testing health endpoint..."
    
    if kubectl port-forward -n "${namespace}" \
        svc/devpulse-app 8080:3000 &>/dev/null & then
        sleep 2
        
        if curl -s http://localhost:8080/health 2>/dev/null | grep -q '"status"'; then
            log_success "Health check passed"
        else
            log_warning "Health check failed or endpoint not ready"
        fi
        
        kill %1 2>/dev/null || true
    fi
}

run_integration_tests() {
    local namespace=$1
    
    log "Running integration tests..."
    
    kubectl run devpulse-tests \
        --image=devpulse-tests:latest \
        --restart=Never \
        --rm \
        -i \
        --namespace "${namespace}" \
        -- npm run test:integration
    
    log_success "Integration tests completed"
}

###############################################################################
# Rollback Functions
###############################################################################

rollback_deployment() {
    local namespace=$1
    local release_name="devpulse"
    
    if [[ "${ENVIRONMENT}" != "prod" ]]; then
        release_name="devpulse-${ENVIRONMENT}"
    fi
    
    log "Rolling back deployment: ${release_name}"
    
    helm rollback "${release_name}" -n "${namespace}"
    
    log_success "Rollback completed"
}

###############################################################################
# Reporting Functions
###############################################################################

print_deployment_summary() {
    local namespace=$1
    
    echo ""
    echo "======================================================================"
    echo "                    DEPLOYMENT SUMMARY                               "
    echo "======================================================================"
    echo ""
    echo "Environment:    ${ENVIRONMENT^^}"
    echo "Namespace:      ${namespace}"
    echo "Timestamp:      ${TIMESTAMP}"
    echo "Log File:       ${LOG_FILE}"
    echo ""
    
    echo "Pod Status:"
    kubectl get pods -n "${namespace}" | tail -n +2 | while read -r line; do
        echo "  ${line}"
    done
    
    echo ""
    echo "Services:"
    kubectl get svc -n "${namespace}" | tail -n +2 | while read -r line; do
        echo "  ${line}"
    done
    
    echo ""
    echo "Resource Usage:"
    kubectl top pods -n "${namespace}" 2>/dev/null | tail -n +2 | while read -r line; do
        echo "  ${line}"
    done
    
    echo ""
    echo "======================================================================"
}

###############################################################################
# Main Orchestration
###############################################################################

main() {
    log "Starting DevPulse Kubernetes deployment"
    log "Environment: ${ENVIRONMENT}, Action: ${ACTION}"
    
    # Pre-deployment checks
    check_prerequisites || exit 1
    validate_environment || exit 1
    check_cluster_connectivity || exit 1
    
    # Setup infrastructure
    local namespace
    namespace=$(setup_namespace)
    
    # Handle different actions
    case "${ACTION}" in
        install)
            add_helm_repos
            create_secrets "${namespace}"
            deploy_helm_chart "${namespace}"
            initialize_database "${namespace}"
            setup_monitoring "${namespace}"
            sleep 30
            verify_deployment "${namespace}"
            ;;
        
        upgrade)
            add_helm_repos
            deploy_helm_chart "${namespace}"
            verify_deployment "${namespace}"
            ;;
        
        rollback)
            rollback_deployment "${namespace}"
            ;;
        
        *)
            log_error "Unknown action: ${ACTION}"
            exit 1
            ;;
    esac
    
    # Print summary
    print_deployment_summary "${namespace}"
    
    log_success "Deployment completed successfully"
}

# Run main function
main "$@"
