{{- /*
Helm Template Helpers for DevPulse
Common functions and macros used across templates
*/ -}}

{{/*
Expand the name of the chart.
*/}}
{{- define "devpulse.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "devpulse.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "devpulse.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "devpulse.labels" -}}
helm.sh/chart: {{ include "devpulse.chart" . }}
{{ include "devpulse.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.global.environment }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "devpulse.selectorLabels" -}}
app.kubernetes.io/name: {{ include "devpulse.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "devpulse.serviceAccountName" -}}
{{- if .Values.app.serviceAccount.create }}
{{- default (include "devpulse.fullname" .) .Values.app.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.app.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database connection string
*/}}
{{- define "devpulse.database.url" -}}
postgresql://{{ .Values.secrets.database.usernameKey }}:{{ .Values.secrets.database.passwordKey }}@{{ .Values.secrets.database.host }}:{{ .Values.secrets.database.port }}/{{ .Values.secrets.database.database }}
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "devpulse.redis.url" -}}
redis://:{{ .Values.secrets.redis.passwordKey }}@{{ .Values.secrets.redis.host }}:{{ .Values.secrets.redis.port }}
{{- end }}

{{/*
Image pull secrets
*/}}
{{- define "devpulse.imagePullSecrets" -}}
{{- if .Values.app.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.app.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Security context
*/}}
{{- define "devpulse.securityContext" -}}
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
{{- end }}

{{/*
Resource requests and limits
*/}}
{{- define "devpulse.resources" -}}
resources:
{{- if .Values.app.resources.requests }}
  requests:
    cpu: {{ .Values.app.resources.requests.cpu | quote }}
    memory: {{ .Values.app.resources.requests.memory | quote }}
{{- end }}
{{- if .Values.app.resources.limits }}
  limits:
    cpu: {{ .Values.app.resources.limits.cpu | quote }}
    memory: {{ .Values.app.resources.limits.memory | quote }}
{{- end }}
{{- end }}

{{/*
Liveness probe
*/}}
{{- define "devpulse.livenessProbe" -}}
livenessProbe:
  httpGet:
    path: {{ .path | default "/health/live" }}
    port: {{ .port | default 3000 }}
  initialDelaySeconds: {{ .initialDelaySeconds | default 30 }}
  periodSeconds: {{ .periodSeconds | default 10 }}
  timeoutSeconds: {{ .timeoutSeconds | default 3 }}
  failureThreshold: {{ .failureThreshold | default 3 }}
{{- end }}

{{/*
Readiness probe
*/}}
{{- define "devpulse.readinessProbe" -}}
readinessProbe:
  httpGet:
    path: {{ .path | default "/health/ready" }}
    port: {{ .port | default 3000 }}
  initialDelaySeconds: {{ .initialDelaySeconds | default 10 }}
  periodSeconds: {{ .periodSeconds | default 5 }}
  timeoutSeconds: {{ .timeoutSeconds | default 3 }}
  failureThreshold: {{ .failureThreshold | default 3 }}
{{- end }}

{{/*
Startup probe
*/}}
{{- define "devpulse.startupProbe" -}}
startupProbe:
  httpGet:
    path: {{ .path | default "/health/startup" }}
    port: {{ .port | default 3000 }}
  failureThreshold: {{ .failureThreshold | default 30 }}
  periodSeconds: {{ .periodSeconds | default 10 }}
{{- end }}

{{/*
Pod anti-affinity
*/}}
{{- define "devpulse.podAntiAffinity" -}}
{{- if eq .Values.app.podAntiAffinity.type "required" }}
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app
              operator: In
              values:
                - {{ include "devpulse.name" . }}
        topologyKey: {{ .Values.app.podAntiAffinity.topologyKey }}
{{- else }}
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: {{ .Values.app.podAntiAffinity.weight }}
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - {{ include "devpulse.name" . }}
          topologyKey: {{ .Values.app.podAntiAffinity.topologyKey }}
{{- end }}
{{- end }}

{{/*
Node affinity
*/}}
{{- define "devpulse.nodeAffinity" -}}
{{- if or .Values.app.nodeAffinity.requiredDuringScheduling .Values.app.nodeAffinity.preferredDuringScheduling }}
affinity:
  nodeAffinity:
{{- if .Values.app.nodeAffinity.requiredDuringScheduling }}
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
{{- range .Values.app.nodeAffinity.requiredDuringScheduling }}
        - matchExpressions:
            - key: {{ .key }}
              operator: {{ .operator }}
              values: {{ .values | toJson }}
{{- end }}
{{- end }}
{{- if .Values.app.nodeAffinity.preferredDuringScheduling }}
    preferredDuringSchedulingIgnoredDuringExecution:
{{- range .Values.app.nodeAffinity.preferredDuringScheduling }}
      - weight: {{ .weight }}
        preference:
          matchExpressions:
            - key: {{ .preference.matchExpressions[0].key }}
              operator: {{ .preference.matchExpressions[0].operator }}
              values: {{ .preference.matchExpressions[0].values | toJson }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Environment variables
*/}}
{{- define "devpulse.env" -}}
{{- range $key, $value := .Values.app.env }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: devpulse-secrets
      key: DATABASE_URL
- name: REDIS_URL
  valueFrom:
    secretKeyRef:
      name: devpulse-secrets
      key: REDIS_URL
{{- end }}

{{/*
Render a value that contains template.
*/}}
{{- define "devpulse.tpl" -}}
    {{- if typeIs "string" .value }}
        {{- tpl .value .context }}
    {{- else }}
        {{- tpl (.value | toJson) .context }}
    {{- end }}
{{- end }}
