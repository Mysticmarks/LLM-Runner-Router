{{/*
Expand the name of the chart.
*/}}
{{- define "llm-runner-router.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "llm-runner-router.fullname" -}}
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
{{- define "llm-runner-router.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "llm-runner-router.labels" -}}
helm.sh/chart: {{ include "llm-runner-router.chart" . }}
{{ include "llm-runner-router.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "llm-runner-router.selectorLabels" -}}
app.kubernetes.io/name: {{ include "llm-runner-router.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "llm-runner-router.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "llm-runner-router.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the config map
*/}}
{{- define "llm-runner-router.configMapName" -}}
{{- printf "%s-config" (include "llm-runner-router.fullname" .) }}
{{- end }}

{{/*
Create the name of the secret
*/}}
{{- define "llm-runner-router.secretName" -}}
{{- printf "%s-secrets" (include "llm-runner-router.fullname" .) }}
{{- end }}

{{/*
Generate certificates secret name
*/}}
{{- define "llm-runner-router.tlsSecretName" -}}
{{- printf "%s-tls" (include "llm-runner-router.fullname" .) }}
{{- end }}

{{/*
Generate WebSocket certificates secret name
*/}}
{{- define "llm-runner-router.wsTlsSecretName" -}}
{{- printf "%s-ws-tls" (include "llm-runner-router.fullname" .) }}
{{- end }}

{{/*
Create image pull secret name
*/}}
{{- define "llm-runner-router.imagePullSecretName" -}}
{{- printf "%s-registry-secret" (include "llm-runner-router.fullname" .) }}
{{- end }}

{{/*
Validate required values
*/}}
{{- define "llm-runner-router.validateValues" -}}
{{- if not .Values.image.repository }}
{{- fail "image.repository is required" }}
{{- end }}
{{- if not .Values.image.tag }}
{{- fail "image.tag is required" }}
{{- end }}
{{- end }}

{{/*
Generate environment-specific values
*/}}
{{- define "llm-runner-router.environmentValues" -}}
{{- $env := .Values.environment | default "production" }}
{{- if hasKey .Values.environments $env }}
{{- $envValues := index .Values.environments $env }}
{{- mergeOverwrite .Values $envValues | toYaml }}
{{- else }}
{{- .Values | toYaml }}
{{- end }}
{{- end }}

{{/*
Generate resource requests and limits
*/}}
{{- define "llm-runner-router.resources" -}}
{{- $env := .Values.environment | default "production" }}
{{- if hasKey .Values.environments $env }}
{{- $envValues := index .Values.environments $env }}
{{- if $envValues.resources }}
{{- $envValues.resources | toYaml }}
{{- else }}
{{- .Values.deployment.pod.container.resources | toYaml }}
{{- end }}
{{- else }}
{{- .Values.deployment.pod.container.resources | toYaml }}
{{- end }}
{{- end }}

{{/*
Generate replica count
*/}}
{{- define "llm-runner-router.replicaCount" -}}
{{- $env := .Values.environment | default "production" }}
{{- if hasKey .Values.environments $env }}
{{- $envValues := index .Values.environments $env }}
{{- if $envValues.replicaCount }}
{{- $envValues.replicaCount }}
{{- else }}
{{- .Values.deployment.replicaCount }}
{{- end }}
{{- else }}
{{- .Values.deployment.replicaCount }}
{{- end }}
{{- end }}

{{/*
Generate storage size for model cache
*/}}
{{- define "llm-runner-router.modelCacheSize" -}}
{{- $env := .Values.environment | default "production" }}
{{- if hasKey .Values.environments $env }}
{{- $envValues := index .Values.environments $env }}
{{- if $envValues.persistence }}
{{- if $envValues.persistence.modelCache }}
{{- if $envValues.persistence.modelCache.size }}
{{- $envValues.persistence.modelCache.size }}
{{- else }}
{{- .Values.persistence.modelCache.size }}
{{- end }}
{{- else }}
{{- .Values.persistence.modelCache.size }}
{{- end }}
{{- else }}
{{- .Values.persistence.modelCache.size }}
{{- end }}
{{- else }}
{{- .Values.persistence.modelCache.size }}
{{- end }}
{{- end }}

{{/*
Common annotations
*/}}
{{- define "llm-runner-router.commonAnnotations" -}}
app.kubernetes.io/part-of: llm-runner-router
app.kubernetes.io/component: {{ .component | default "backend" }}
{{- if .Values.monitoring.enabled }}
prometheus.io/scrape: "true"
{{- end }}
{{- end }}

{{/*
Pod Security Context
*/}}
{{- define "llm-runner-router.podSecurityContext" -}}
{{- if .Values.podSecurityContext }}
{{- toYaml .Values.podSecurityContext }}
{{- else }}
runAsNonRoot: true
runAsUser: 1001
runAsGroup: 1001
fsGroup: 1001
{{- end }}
{{- end }}

{{/*
Container Security Context
*/}}
{{- define "llm-runner-router.containerSecurityContext" -}}
{{- if .Values.securityContext }}
{{- toYaml .Values.securityContext }}
{{- else }}
allowPrivilegeEscalation: false
capabilities:
  drop:
    - ALL
readOnlyRootFilesystem: false
{{- end }}
{{- end }}