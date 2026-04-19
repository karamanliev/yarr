"use strict";

(function() {
  var xfetch = function(resource, init) {
    init = init || {}
    if (['post', 'put', 'delete'].indexOf(init.method) !== -1) {
      init['headers'] = init['headers'] || {}
      init['headers']['x-requested-by'] = 'yarr'
    }
    return fetch(resource, init)
  }
  var api = function(method, endpoint, data) {
    var headers = {'Content-Type': 'application/json'}
    return xfetch(endpoint, {
      method: method,
      headers: headers,
      body: JSON.stringify(data),
    })
  }

  var json = function(res) {
    return res.json()
  }

  var param = function(query) {
    if (!query) return ''
    return '?' + Object.keys(query).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(query[key])
    }).join('&')
  }

  window.api = {
    feeds: {
      list: function() {
        return api('get', './api/feeds').then(json)
      },
      create: function(data) {
        return api('post', './api/feeds', data).then(json)
      },
      update: function(id, data) {
        return api('put', './api/feeds/' + id, data)
      },
      delete: function(id) {
        return api('delete', './api/feeds/' + id)
      },
      list_items: function(id) {
        return api('get', './api/feeds/' + id + '/items').then(json)
      },
      refresh: function() {
        return api('post', './api/feeds/refresh')
      },
      list_errors: function() {
        return api('get', './api/feeds/errors').then(json)
      },
    },
    folders: {
      list: function() {
        return api('get', './api/folders').then(json)
      },
      create: function(data) {
        return api('post', './api/folders', data).then(json)
      },
      update: function(id, data) {
        return api('put', './api/folders/' + id, data)
      },
      delete: function(id) {
        return api('delete', './api/folders/' + id)
      },
      list_items: function(id) {
        return api('get', './api/folders/' + id + '/items').then(json)
      }
    },
    items: {
      get: function(id) {
        return api('get', './api/items/' + id).then(json)
      },
      list: function(query) {
        return api('get', './api/items' + param(query)).then(json)
      },
      update: function(id, data) {
        return api('put', './api/items/' + id, data)
      },
      mark_read: function(query) {
        return api('put', './api/items' + param(query))
      },
      summary_stream: function(id, handlers) {
        handlers = handlers || {}
        var controller = handlers.signal ? null : new AbortController()
        var signal = handlers.signal || controller.signal
        xfetch('./api/items/' + id + '/summary', {
          method: 'post',
          headers: {'Accept': 'text/event-stream'},
          signal: signal,
        }).then(function(res) {
          if (!res.ok || !res.body) {
            return res.json().catch(function() { return {error: 'Request failed'} }).then(function(data) {
              if (handlers.onError) handlers.onError(new Error(data.error || 'Request failed'))
            })
          }
          var reader = res.body.getReader()
          var decoder = new TextDecoder()
          var buf = ''
          var pump = function() {
            return reader.read().then(function(result) {
              if (result.done) {
                if (handlers.onDone) handlers.onDone()
                return
              }
              buf += decoder.decode(result.value, {stream: true})
              var frames = buf.split('\n\n')
              buf = frames.pop()
              frames.forEach(function(frame) {
                var event = 'message'
                var data = ''
                frame.split('\n').forEach(function(line) {
                  if (line.indexOf('event:') === 0) event = line.slice(6).trim()
                  else if (line.indexOf('data:') === 0) data += line.slice(5).trim()
                })
                var parsed
                try { parsed = JSON.parse(data) } catch (e) { parsed = data }
                if (event === 'delta' && handlers.onDelta) {
                  handlers.onDelta(parsed)
                } else if (event === 'done' && handlers.onDone) {
                  handlers.onDone()
                } else if (event === 'error' && handlers.onError) {
                  handlers.onError(new Error((parsed && parsed.message) || 'stream error'))
                }
              })
              return pump()
            })
          }
          return pump()
        }).catch(function(err) {
          if (err && err.name === 'AbortError') return
          if (handlers.onError) handlers.onError(err)
        })
        return controller
      },
    },
    settings: {
      get: function() {
        return api('get', './api/settings').then(json)
      },
      update: function(data) {
        return api('put', './api/settings', data)
      },
    },
    status: function() {
      return api('get', './api/status').then(json)
    },
    upload_opml: function(form) {
      return xfetch('./opml/import', {
        method: 'post',
        body: new FormData(form),
      })
    },
    logout: function() {
      return api('post', './logout')
    },
    crawl: function(url) {
      return api('get', './page?url=' + encodeURIComponent(url)).then(json)
    }
  }
})()
