#!/bin/bash
# PostgreSQL Primary Initialization Script
# Creates replication user and enables WAL

set -e

# Create replication user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE ROLE replication WITH REPLICATION LOGIN ENCRYPTED PASSWORD '$POSTGRES_PASSWORD';
    \du
EOSQL

echo "PostgreSQL Primary initialization complete"
