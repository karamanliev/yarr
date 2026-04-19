//go:build !debug

package assets

import "embed"

//go:embed *.html
//go:embed themes.json
//go:embed graphicarts
//go:embed javascripts
//go:embed stylesheets
var embedded embed.FS

func init() {
	FS.embedded = &embedded
}
