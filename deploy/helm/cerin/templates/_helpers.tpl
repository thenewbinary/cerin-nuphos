{{- define "cerin.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 50 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 50 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "cerin.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{/* Usage: include "cerin.selectorLabels" (list $ "backend") */}}
{{- define "cerin.selectorLabels" -}}
{{- $ := index . 0 -}}
app.kubernetes.io/name: {{ $.Chart.Name }}
app.kubernetes.io/instance: {{ $.Release.Name }}
app.kubernetes.io/component: {{ index . 1 }}
{{- end -}}

{{- define "cerin.secretName" -}}
{{- .Values.secrets.existingSecret | default (printf "%s-secrets" (include "cerin.fullname" .)) -}}
{{- end -}}

{{/* Stable pod DNS name; the replica set member and backend URI both use it. */}}
{{- define "cerin.mongoHost" -}}
{{- $name := printf "%s-mongo" (include "cerin.fullname" .) -}}
{{- printf "%s-0.%s.%s.svc" $name $name .Release.Namespace -}}
{{- end -}}


{{- define "cerin.backendUrl" -}}
{{- required "backend.url is required" .Values.backend.url | trimSuffix "/" -}}
{{- end -}}

{{- define "cerin.storageUrl" -}}
{{- required "storage.url is required" .Values.storage.url | trimSuffix "/" -}}
{{- end -}}

{{- define "cerin.runtimeUrl" -}}
{{- required "runtime.url is required when runtime.enabled" .Values.runtime.url | trimSuffix "/" -}}
{{- end -}}
