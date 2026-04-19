package auth

import (
	"net/http"
	"strings"

	"github.com/nkanaev/yarr/src/assets"
	"github.com/nkanaev/yarr/src/server/router"
	"github.com/nkanaev/yarr/src/server/theme"
	"github.com/nkanaev/yarr/src/storage"
)

type Middleware struct {
	Username string
	Password string
	BasePath string
	Public   []string
	DB       *storage.Storage
}

func unsafeMethod(method string) bool {
	return method == "POST" || method == "PUT" || method == "DELETE"
}

func (m *Middleware) Handler(c *router.Context) {
	for _, path := range m.Public {
		if strings.HasPrefix(c.Req.URL.Path, m.BasePath+path) {
			c.Next()
			return
		}
	}
	if IsAuthenticated(c.Req, m.Username, m.Password) {
		c.Next()
		return
	}

	rootUrl := m.BasePath + "/"

	if c.Req.URL.Path != rootUrl {
		c.Out.WriteHeader(http.StatusUnauthorized)
		return
	}

	if c.Req.Method == "POST" {
		username := c.Req.FormValue("username")
		password := c.Req.FormValue("password")
		if StringsEqual(username, m.Username) && StringsEqual(password, m.Password) {
			Authenticate(c.Out, m.Username, m.Password, m.BasePath)
			c.Redirect(rootUrl)
			return
		} else {
			settings := m.DB.GetSettings()
			c.HTML(http.StatusOK, assets.Template("login.html"), map[string]interface{}{
				"username": username,
				"error":    "Invalid username/password",
				"settings": settings,
				"theme":    theme.Resolve(settings),
			})
			return
		}
	}
	settings := m.DB.GetSettings()
	c.HTML(http.StatusOK, assets.Template("login.html"), map[string]interface{}{
		"settings": settings,
		"theme":    theme.Resolve(settings),
	})
}
