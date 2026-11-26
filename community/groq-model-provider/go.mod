module github.com/obot-platform/providers/groq-model-provider

go 1.27

replace github.com/obot-platform/providers/openai-model-provider => ../openai-model-provider

require github.com/obot-platform/providers/openai-model-provider v0.0.0

replace github.com/obot-platform/chat-completion-client => ../../third_party/go/chat-completion-client
