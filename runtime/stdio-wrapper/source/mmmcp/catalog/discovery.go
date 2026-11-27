package catalog

import (
	"context"
	"fmt"

	"github.com/HarshDeshmukh26/Providers/runtime/stdio-wrapper/source/mmmcp/component"
	"github.com/HarshDeshmukh26/Providers/runtime/stdio-wrapper/source/mmmcp/config"
)

// Compile discovers every configured component and builds a complete snapshot.
func Compile(ctx context.Context, cfg *config.Config, discoverer component.Discoverer) (*Catalog, error) {
	if cfg == nil {
		return nil, fmt.Errorf("catalog: nil config")
	}
	if discoverer == nil {
		return nil, fmt.Errorf("catalog: nil discoverer")
	}
	return compile(ctx, cfg, discoverer)
}
