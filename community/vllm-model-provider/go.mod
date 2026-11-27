module github.com/HarshDeshmukh26/Providers/community/vllm-model-provider

go 1.27

replace github.com/HarshDeshmukh26/Providers/community/openai-model-provider => ../openai-model-provider

require (
	github.com/HarshDeshmukh26/Providers/community/openai-model-provider v0.0.0
	github.com/HarshDeshmukh26/Providers/third_party/go/chat-completion-client v0.0.0-20260529163740-88dd50945c18
)

replace github.com/HarshDeshmukh26/Providers/third_party/go/chat-completion-client => ../../third_party/go/chat-completion-client
