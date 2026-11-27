module github.com/HarshDeshmukh26/Providers/enterprise/gemini-vertex-model-provider

go 1.26.4

require (
	github.com/HarshDeshmukh26/Providers/third_party/go/openai-model-provider v0.0.0-20260605221712-d90e9d6df0eb
	golang.org/x/oauth2 v0.32.0
)

require cloud.google.com/go/compute/metadata v0.3.0 // indirect

replace github.com/HarshDeshmukh26/Providers/third_party/go/openai-model-provider => ../../third_party/go/openai-model-provider

replace github.com/HarshDeshmukh26/Providers/third_party/go/chat-completion-client => ../../third_party/go/chat-completion-client
