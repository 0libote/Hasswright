name: Bug report
description: Something broken in Hasswright
labels: [bug]
body:
  - type: input
    id: version
    attributes: { label: "Hasswright version", placeholder: "e.g. 0.1.0" }
    validations: { required: true }
  - type: dropdown
    id: install
    attributes:
      label: "Install type"
      options: ["HAOS app (add-on)", "Local dev (npm start)", "Docker / other"]
    validations: { required: true }
  - type: textarea
    id: what
    attributes: { label: "What happened, and what did you expect?" }
    validations: { required: true }
  - type: textarea
    id: repro
    attributes: { label: "Steps to reproduce" }
  - type: textarea
    id: logs
    attributes:
      label: "Relevant logs (Settings → audit, add-on log). Redact tokens before pasting!"
      render: text
