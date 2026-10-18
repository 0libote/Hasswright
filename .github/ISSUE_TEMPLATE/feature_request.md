name: Feature request
description: Idea for Hasswright
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes: { label: "What Home Assistant task should this make easier?" }
    validations: { required: true }
  - type: textarea
    id: proposal
    attributes: { label: "Proposed behavior (including which mode/risk level it needs)" }
  - type: checkboxes
    id: safety
    attributes:
      label: "Safety checklist"
      options:
        - label: "I considered which mode (observe/assist/managed) this needs and whether approval is required"
