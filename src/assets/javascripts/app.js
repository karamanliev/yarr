'use strict';

var TITLE = document.title

// Tiny, safe Markdown renderer for AI summary output. Escapes HTML first,
// then re-introduces a controlled set of tags. Not a full CommonMark impl.
window.yarrRenderMarkdown = (function() {
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
  function safeUrl(url) {
    var u = String(url || '').trim()
    if (/^(https?:|mailto:)/i.test(u)) return u
    return '#'
  }
  function inline(text) {
    // inline code
    text = text.replace(/`([^`]+?)`/g, function(_, c) { return '<code>' + c + '</code>' })
    // bold **x** / __x__
    text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    text = text.replace(/__([^_]+?)__/g, '<strong>$1</strong>')
    // italic *x* / _x_
    text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    text = text.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>')
    // links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(_, t, u) {
      return '<a href="' + safeUrl(u) + '" rel="noopener noreferrer" target="_blank">' + t + '</a>'
    })
    return text
  }
  return function render(src) {
    if (!src) return ''
    src = String(src).replace(/\r\n?/g, '\n')
    // Extract fenced code blocks first.
    var codeBlocks = []
    src = src.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(_, lang, code) {
      codeBlocks.push('<pre><code>' + escapeHtml(code) + '</code></pre>')
      return '\u0000CODE' + (codeBlocks.length - 1) + '\u0000'
    })
    src = escapeHtml(src)

    var lines = src.split('\n')
    var out = []
    var i = 0
    while (i < lines.length) {
      var line = lines[i]
      // heading
      var h = /^(#{1,6})\s+(.+)$/.exec(line)
      if (h) {
        var level = h[1].length
        out.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>')
        i++
        continue
      }
      // unordered list
      if (/^[-*]\s+/.test(line)) {
        var items = []
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          items.push('<li>' + inline(lines[i].replace(/^[-*]\s+/, '')) + '</li>')
          i++
        }
        out.push('<ul>' + items.join('') + '</ul>')
        continue
      }
      // ordered list
      if (/^\d+\.\s+/.test(line)) {
        var oitems = []
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          oitems.push('<li>' + inline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>')
          i++
        }
        out.push('<ol>' + oitems.join('') + '</ol>')
        continue
      }
      // blank line: paragraph separator
      if (line.trim() === '') {
        i++
        continue
      }
      // paragraph: accumulate until blank line or block element
      var para = [line]
      i++
      while (i < lines.length) {
        var l = lines[i]
        if (l.trim() === '') break
        if (/^(#{1,6})\s+/.test(l)) break
        if (/^[-*]\s+/.test(l)) break
        if (/^\d+\.\s+/.test(l)) break
        para.push(l)
        i++
      }
      out.push('<p>' + inline(para.join('<br>')) + '</p>')
    }

    var html = out.join('\n')
    // restore code blocks
    html = html.replace(/\u0000CODE(\d+)\u0000/g, function(_, n) { return codeBlocks[+n] })
    return html
  }
})()

function scrollto(target, scroll) {
  var padding = 10
  var targetRect = target.getBoundingClientRect()
  var scrollRect = scroll.getBoundingClientRect()

  // target
  var relativeOffset = targetRect.y - scrollRect.y
  var absoluteOffset = relativeOffset + scroll.scrollTop

  if (padding <= relativeOffset && relativeOffset + targetRect.height <= scrollRect.height - padding) return

  var newPos = scroll.scrollTop
  if (relativeOffset < padding) {
    newPos = absoluteOffset - padding
  } else {
    newPos = absoluteOffset - scrollRect.height + targetRect.height + padding
  }
  scroll.scrollTop = Math.round(newPos)
}

var debounce = function(callback, wait) {
  var timeout
  return function() {
    var ctx = this, args = arguments
    clearTimeout(timeout)
    timeout = setTimeout(function() {
      callback.apply(ctx, args)
    }, wait)
  }
}

Vue.directive('scroll', {
  inserted: function(el, binding) {
    el.addEventListener('scroll', debounce(function(event) {
      binding.value(event, el)
    }, 200))
  },
})

Vue.directive('focus', {
  inserted: function(el) {
    el.focus()
  }
})

Vue.component('drag', {
  props: ['width'],
  template: '<div class="drag"></div>',
  mounted: function() {
    var self = this
    var startX = undefined
    var initW = undefined
    var onMouseMove = function(e) {
      var offset = e.clientX - startX
      var newWidth = initW + offset
      self.$emit('resize', newWidth)
    }
    var onMouseUp = function(e) {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    this.$el.addEventListener('mousedown', function(e) {
      startX = e.clientX
      initW = self.width
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  },
})

Vue.component('dropdown', {
  props: ['class', 'toggle-class', 'ref', 'drop', 'title'],
  data: function() {
    return {open: false}
  },
  template: `
    <div class="dropdown" :class="$attrs.class">
      <button ref="btn" @click="toggle" :class="btnToggleClass" :title="$props.title"><slot name="button"></slot></button>
      <div ref="menu" class="dropdown-menu" :class="{show: open}"><slot v-if="open"></slot></div>
    </div>
  `,
  computed: {
    btnToggleClass: function() {
      var c = this.$props.toggleClass || ''
      c += ' dropdown-toggle dropdown-toggle-no-caret'
      c += this.open ? ' show' : ''
      return c.trim()
    }
  },
  methods: {
    toggle: function(e) {
      this.open ? this.hide() : this.show()
    },
    show: function(e) {
      this.open = true
      this.$refs.menu.style.top = this.$refs.btn.offsetHeight + 'px'
      var drop = this.$props.drop

      if (drop === 'right') {
        this.$refs.menu.style.left = 'auto'
        this.$refs.menu.style.right = '0'
      } else if (drop === 'center') {
        this.$nextTick(function() {
          var btnWidth = this.$refs.btn.getBoundingClientRect().width
          var menuWidth = this.$refs.menu.getBoundingClientRect().width
          this.$refs.menu.style.left = '-' + ((menuWidth - btnWidth) / 2) + 'px'
        }.bind(this))
      }

      document.addEventListener('click', this.clickHandler)
    },
    hide: function() {
      this.open = false
      document.removeEventListener('click', this.clickHandler)
    },
    clickHandler: function(e) {
      var dropdown = e.target.closest('.dropdown')
      if (dropdown == null || dropdown != this.$el) return this.hide()
      if (e.target.closest('.dropdown-item') != null) return this.hide()
    }
  },
})

Vue.component('modal', {
  props: ['open'],
  template: `
    <div class="modal custom-modal" tabindex="-1" v-if="$props.open">
      <div class="modal-dialog">
        <div class="modal-content" ref="content">
          <div class="modal-body">
            <slot v-if="$props.open"></slot>
          </div>
        </div>
      </div>
    </div>
  `,
  data: function() {
    return {opening: false}
  },
  watch: {
    'open': function(newVal) {
      if (newVal) {
        this.opening = true
        document.addEventListener('click', this.handleClick)
      } else {
        document.removeEventListener('click', this.handleClick)
      }
    },
  },
  methods: {
    handleClick: function(e) {
      if (this.opening) {
        this.opening = false
        return
      }
      if (e.target.closest('.modal-content') == null) this.$emit('hide')
    },
  },
})

function dateRepr(d) {
  var sec = (new Date().getTime() - d.getTime()) / 1000
  var neg = sec < 0
  var out = ''

  sec = Math.abs(sec)
  if (sec < 2700)  // less than 45 minutes
    out = Math.round(sec / 60) + 'm'
  else if (sec < 86400)  // less than 24 hours
    out = Math.round(sec / 3600) + 'h'
  else if (sec < 604800)  // less than a week
    out = Math.round(sec / 86400) + 'd'
  else
    out = d.toLocaleDateString(undefined, {year: "numeric", month: "long", day: "numeric"})

  if (neg) return '-' + out
  return out
}

Vue.component('relative-time', {
  props: ['val'],
  data: function() {
    var d = new Date(this.val)
    return {
      'date': d,
      'formatted': dateRepr(d),
      'interval': null,
    }
  },
  template: '<time :datetime="val">{{ formatted }}</time>',
  mounted: function() {
    this.interval = setInterval(function() {
      this.formatted = dateRepr(this.date)
    }.bind(this), 600000)  // every 10 minutes
  },
  destroyed: function() {
    clearInterval(this.interval)
  },
})

var vm = new Vue({
  created: function() {
    this.refreshStats()
      .then(this.refreshFeeds.bind(this))
      .then(this.refreshItems.bind(this, false))

    api.feeds.list_errors().then(function(errors) {
      vm.feed_errors = errors
    })
    if (!this.theme.mode && !this.theme.auto) {
      var detected = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      this.theme.mode = detected
      api.settings.update({theme_mode: detected})
    }
    this.applyTheme()
    this.initAutoThemeListener()

    var self = this
    this._onVisibilityChange = function() {
      if (!document.hidden) {
        self.onTabVisible()
      }
    }
    document.addEventListener('visibilitychange', this._onVisibilityChange)

    this._eventSource = new EventSource('./api/events')
    this._eventSource.addEventListener('sync', function() {
      self.onTabVisible()
    })
  },
  beforeDestroy: function() {
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange)
    }
    if (this._eventSource) {
      this._eventSource.close()
    }
  },
  data: function() {
    var s = app.settings
    return {
      'filterSelected': s.filter,
      'folders': [],
      'feeds': [],
      'feedSelected': s.feed,
      'feedListWidth': s.feed_list_width || 300,
      'feedNewChoice': [],
      'feedNewChoiceSelected': '',
      'items': [],
      'itemsHasMore': true,
      'itemSelected': null,
      'itemSelectedDetails': null,
      'itemSelectedReadability': '',
      'itemSelectedSummary': null,
      'summaryInProgress': false,
      'summaryAbortController': null,
      'aiSettings': {
        'endpoint': s.ai_endpoint || '',
        'api_key': s.ai_api_key || '',
        'model': s.ai_model || '',
        'system_prompt_custom_enabled': !!s.ai_system_prompt_custom_enabled,
        'system_prompt_custom': s.ai_system_prompt_custom || '',
      },
      'itemSearch': '',
      'itemSortNewestFirst': s.sort_newest_first,
      'itemListWidth': s.item_list_width || 300,

      'filteredFeedStats': {},
      'filteredFolderStats': {},
      'filteredTotalStats': null,

      'settings': '',
      'loading': {
        'feeds': 0,
        'newfeed': false,
        'items': false,
        'readability': false,
      },
      'fonts': ['', 'serif', 'monospace'],
      'feedStats': {},
      'theme': {
        'font': s.theme_font,
        'size': s.theme_size,
        'auto': !!s.theme_auto,
        'mode': s.theme_mode || '',
        'lightVariant': s.theme_light_variant || 'white',
        'darkVariant': s.theme_dark_variant || 'black',
        'accent': s.theme_accent || 'blue',
      },
      'lightVariants': window.yarrThemes.light,
      'darkVariants': window.yarrThemes.dark,
      'accents': window.yarrThemes.accents,
      'refreshRate': s.refresh_rate,
      'authenticated': app.authenticated,
      'feed_errors': {},

      'refreshRateOptions': [
        { title: "0", value: 0 },
        { title: "10m", value: 10 },
        { title: "30m", value: 30 },
        { title: "1h", value: 60 },
        { title: "2h", value: 120 },
        { title: "4h", value: 240 },
        { title: "12h", value: 720 },
        { title: "24h", value: 1440 },
      ],
    }
  },
  computed: {
    foldersWithFeeds: function() {
      var feedsByFolders = this.feeds.reduce(function(folders, feed) {
        if (!folders[feed.folder_id])
          folders[feed.folder_id] = [feed]
        else
          folders[feed.folder_id].push(feed)
        return folders
      }, {})
      var folders = this.folders.slice().map(function(folder) {
        folder.feeds = feedsByFolders[folder.id]
        return folder
      })
      folders.push({id: null, feeds: feedsByFolders[null]})
      return folders
    },
    feedsById: function() {
      return this.feeds.reduce(function(acc, f) { acc[f.id] = f; return acc }, {})
    },
    foldersById: function() {
      return this.folders.reduce(function(acc, f) { acc[f.id] = f; return acc }, {})
    },
    current: function() {
      var parts = (this.feedSelected || '').split(':', 2)
      var type = parts[0]
      var guid = parts[1]

      var folder = {}, feed = {}

      if (type == 'feed')
        feed = this.feedsById[guid] || {}
      if (type == 'folder')
        folder = this.foldersById[guid] || {}

      return {type: type, feed: feed, folder: folder}
    },
    itemSelectedContent: function() {
      if (!this.itemSelected) return ''

      if (this.itemSelectedSummary !== null)
        return window.yarrRenderMarkdown(this.itemSelectedSummary)

      if (this.itemSelectedReadability)
        return this.itemSelectedReadability

      return this.itemSelectedDetails.content || ''
    },
    aiConfigured: function() {
      return !!(this.aiSettings.endpoint && this.aiSettings.api_key && this.aiSettings.model)
    },
    contentImages: function() {
      if (!this.itemSelectedDetails) return []
      return (this.itemSelectedDetails.media_links || []).filter(l => l.type === 'image')
    },
    contentAudios: function() {
      if (!this.itemSelectedDetails) return []
      return (this.itemSelectedDetails.media_links || []).filter(l => l.type === 'audio')
    },
    contentVideos: function() {
      if (!this.itemSelectedDetails) return []
      return (this.itemSelectedDetails.media_links || []).filter(l => l.type === 'video')
    },
    refreshRateTitle: function () {
      const entry = this.refreshRateOptions.find(o => o.value === this.refreshRate)
      return entry ? entry.title : '0'
    },
  },
  watch: {
    'theme': {
      deep: true,
      handler: function(theme) {
        this.applyTheme()
        api.settings.update({
          theme_font: theme.font,
          theme_size: theme.size,
          theme_auto: theme.auto,
          theme_mode: theme.mode,
          theme_light_variant: theme.lightVariant,
          theme_dark_variant: theme.darkVariant,
          theme_accent: theme.accent,
        })
      },
    },
    'feedStats': {
      deep: true,
      handler: debounce(function() {
        var title = TITLE
        var unreadCount = Object.values(this.feedStats).reduce(function(acc, stat) {
          return acc + stat.unread
        }, 0)
        if (unreadCount) {
          title += ' ('+unreadCount+')'
        }
        document.title = title
        this.computeStats()
      }, 500),
    },
    'filterSelected': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      this.itemSelected = null
      this.items = []
      this.itemsHasMore = true
      api.settings.update({filter: newVal}).then(this.refreshItems.bind(this, false))
      this.computeStats()
    },
    'feedSelected': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      this.itemSelected = null
      this.items = []
      this.itemsHasMore = true
      api.settings.update({feed: newVal}).then(this.refreshItems.bind(this, false))
      if (this.$refs.itemlist) this.$refs.itemlist.scrollTop = 0
    },
    'aiSettings': {
      deep: true,
      handler: debounce(function(ai) {
        var payload = {
          ai_endpoint: ai.endpoint,
          ai_model: ai.model,
          ai_system_prompt_custom_enabled: !!ai.system_prompt_custom_enabled,
          ai_system_prompt_custom: ai.system_prompt_custom,
        }
        // Only push the API key when the user actually changed it away from
        // the masked sentinel.
        if (ai.api_key !== '***') {
          payload.ai_api_key = ai.api_key
        }
        api.settings.update(payload)
      }, 500),
    },
    'itemSelected': function(newVal, oldVal) {
      this.itemSelectedReadability = ''
      this.cancelSummaryStream()
      this.itemSelectedSummary = null
      if (newVal === null) {
        this.itemSelectedDetails = null
        return
      }
      if (this.$refs.content) this.$refs.content.scrollTop = 0

      api.items.get(newVal).then(function(item) {
        this.itemSelectedDetails = item
        this.$nextTick(this.initHlsVideos)
        if (this.itemSelectedDetails.status == 'unread') {
          api.items.update(this.itemSelectedDetails.id, {status: 'read'}).then(function() {
            this.feedStats[this.itemSelectedDetails.feed_id].unread -= 1
            var itemInList = this.items.find(function(i) { return i.id == item.id })
            if (itemInList) itemInList.status = 'read'
            this.itemSelectedDetails.status = 'read'
          }.bind(this))
        }
      }.bind(this))
    },
    'itemSearch': debounce(function(newVal) {
      this.refreshItems()
    }, 500),
    'itemSortNewestFirst': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({sort_newest_first: newVal}).then(vm.refreshItems.bind(this, false))
    },
    'feedListWidth': debounce(function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({feed_list_width: newVal})
    }, 1000),
    'itemListWidth': debounce(function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({item_list_width: newVal})
    }, 1000),
    'refreshRate': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({refresh_rate: newVal})
    },
  },
  methods: {
    initHlsVideos: function() {
      var contentEl = this.$refs.content
      if (!contentEl) return

      var hlsVideos = []
      contentEl.querySelectorAll('video').forEach(function(video) {
        var src = video.getAttribute('src') || ''
        if (!src) {
          var source = video.querySelector('source')
          if (source) src = source.getAttribute('src') || ''
        }
        if (src && src.indexOf('.m3u8') !== -1) {
          hlsVideos.push({el: video, src: src})
        }
      })

      if (!hlsVideos.length) return

      function attachHls() {
        hlsVideos.forEach(function(item) {
          if (item.el.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari supports HLS natively
            item.el.src = item.src
          } else if (window.Hls && Hls.isSupported()) {
            var hls = new Hls()
            hls.loadSource(item.src)
            hls.attachMedia(item.el)
          }
        })
      }

      if (window.Hls) {
        attachHls()
      } else {
        var script = document.createElement('script')
        script.src = './static/javascripts/hls.min.js'
        script.onload = attachHls
        document.head.appendChild(script)
      }
    },
    contrastFor: function(hex) {
      return window.yarrContrastText(hex)
    },
    getActiveMode: function() {
      if (this.theme.auto && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return this.theme.mode
    },
    applyTheme: function() {
      var mode = this.getActiveMode()
      var resolved = window.yarrResolveTheme(
        mode,
        this.theme.lightVariant,
        this.theme.darkVariant,
        this.theme.accent
      )
      var root = document.documentElement
      root.style.setProperty('--bg', resolved.bg)
      root.style.setProperty('--text', resolved.text)
      root.style.setProperty('--accent', resolved.accent)
      root.style.setProperty('--accent-text', resolved.accentText)
      document.body.classList.value = 'theme-' + resolved.mode
      var meta = document.querySelector("meta[name='theme-color']")
      if (meta) meta.content = resolved.bg
    },
    initAutoThemeListener: function() {
      if (!window.matchMedia) return
      var mq = window.matchMedia('(prefers-color-scheme: dark)')
      var handler = function() {
        if (this.theme.auto) this.applyTheme()
      }.bind(this)
      if (mq.addEventListener) {
        mq.addEventListener('change', handler)
      } else if (mq.addListener) {
        mq.addListener(handler)  // Safari < 14
      }
    },
    toggleAutoTheme: function() {
      if (this.theme.auto) {
        this.theme.mode = this.getActiveMode()
      }
      this.theme.auto = !this.theme.auto
    },
    pickLightVariant: function(key) {
      this.theme.lightVariant = key
      if (!this.theme.auto) this.theme.mode = 'light'
    },
    pickDarkVariant: function(key) {
      this.theme.darkVariant = key
      if (!this.theme.auto) this.theme.mode = 'dark'
    },
    refreshStats: function(loopMode) {
      return api.status().then(function(data) {
        if (loopMode && !vm.itemSelected) vm.refreshItems()

        vm.loading.feeds = data.running
        if (data.running) {
          setTimeout(vm.refreshStats.bind(vm, true), 500)
        }
        vm.feedStats = data.stats.reduce(function(acc, stat) {
          acc[stat.feed_id] = stat
          return acc
        }, {})

        api.feeds.list_errors().then(function(errors) {
          vm.feed_errors = errors
        })
      })
    },
    getItemsQuery: function() {
      var query = {}
      if (this.feedSelected) {
        var parts = this.feedSelected.split(':', 2)
        var type = parts[0]
        var guid = parts[1]
        if (type == 'feed') {
          query.feed_id = guid
        } else if (type == 'folder') {
          query.folder_id = guid
        }
      }
      if (this.filterSelected) {
        query.status = this.filterSelected
      }
      if (this.itemSearch) {
        query.search = this.itemSearch
      }
      if (!this.itemSortNewestFirst) {
        query.oldest_first = true
      }
      return query
    },
    refreshFeeds: function() {
      return Promise
        .all([api.folders.list(), api.feeds.list()])
        .then(function(values) {
          vm.folders = values[0]
          vm.feeds = values[1]
        })
    },
    refreshItems: function(loadMore = false) {
      if (this.feedSelected === null) {
        vm.items = []
        vm.itemsHasMore = false
        return
      }

      var query = this.getItemsQuery()
      if (loadMore) {
        query.after = vm.items[vm.items.length-1].id
      }

      this.loading.items = true
      return api.items.list(query).then(function(data) {
        if (loadMore) {
          vm.items = vm.items.concat(data.list)
        } else {
          vm.items = data.list
        }
        vm.itemsHasMore = data.has_more
        vm.loading.items = false

        // load more if there's some space left at the bottom of the item list.
        vm.$nextTick(function() {
          if (vm.itemsHasMore && !vm.loading.items && vm.itemListCloseToBottom()) {
            vm.refreshItems(true)
          }
        })
      })
    },
    itemListCloseToBottom: function() {
      // approx. vertical space at the bottom of the list (loading el & paddings) when 1rem = 16px
      var bottomSpace = 70
      var scale = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16

      var el = this.$refs.itemlist

      if (el.scrollHeight === 0) return false  // element is invisible (responsive design)

      var closeToBottom = (el.scrollHeight - el.scrollTop - el.offsetHeight) < bottomSpace * scale
      return closeToBottom
    },
    loadMoreItems: function(event, el) {
      if (!this.itemsHasMore) return
      if (this.loading.items) return
      if (this.itemListCloseToBottom()) return this.refreshItems(true)
      if (this.itemSelected && this.itemSelected === this.items[this.items.length - 1].id) return this.refreshItems(true)
    },
    markItemsRead: function() {
      var query = this.getItemsQuery()
      api.items.mark_read(query).then(function() {
        vm.items = []
        vm.itemsPage = {'cur': 1, 'num': 1}
        vm.itemSelected = null
        vm.itemsHasMore = false
        vm.refreshStats()
      })
    },
    toggleFolderExpanded: function(folder) {
      folder.is_expanded = !folder.is_expanded
      api.folders.update(folder.id, {is_expanded: folder.is_expanded})
    },
    formatDate: function(datestr) {
      var options = {
        year: "numeric", month: "long", day: "numeric",
        hour: '2-digit', minute: '2-digit',
      }
      return new Date(datestr).toLocaleDateString(undefined, options)
    },
    moveFeed: function(feed, folder) {
      var folder_id = folder ? folder.id : null
      api.feeds.update(feed.id, {folder_id: folder_id}).then(function() {
        feed.folder_id = folder_id
        vm.refreshStats()
      })
    },
    moveFeedToNewFolder: function(feed) {
      var title = prompt('Enter folder name:')
      if (!title) return
      api.folders.create({'title': title}).then(function(folder) {
        api.feeds.update(feed.id, {folder_id: folder.id}).then(function() {
          vm.refreshFeeds().then(function() {
            vm.refreshStats()
          })
        })
      })
    },
    createNewFeedFolder: function() {
      var title = prompt('Enter folder name:')
      if (!title) return
      api.folders.create({'title': title}).then(function(result) {
        vm.refreshFeeds().then(function() {
          vm.$nextTick(function() {
            if (vm.$refs.newFeedFolder) {
              vm.$refs.newFeedFolder.value = result.id
            }
          })
        })
      })
    },
    renameFolder: function(folder) {
      var newTitle = prompt('Enter new title', folder.title)
      if (newTitle) {
        api.folders.update(folder.id, {title: newTitle}).then(function() {
          folder.title = newTitle
          this.folders.sort(function(a, b) {
            return a.title.localeCompare(b.title)
          })
        }.bind(this))
      }
    },
    deleteFolder: function(folder) {
      if (confirm('Are you sure you want to delete ' + folder.title + '?')) {
        api.folders.delete(folder.id).then(function() {
          vm.feedSelected = null
          vm.refreshStats()
          vm.refreshFeeds()
        })
      }
    },
    updateFeedLink: function(feed) {
      var newLink = prompt('Enter feed link', feed.feed_link)
      if (newLink) {
        api.feeds.update(feed.id, {feed_link: newLink}).then(function() {
          feed.feed_link = newLink
        })
      }
    },
    renameFeed: function(feed) {
      var newTitle = prompt('Enter new title', feed.title)
      if (newTitle) {
        api.feeds.update(feed.id, {title: newTitle}).then(function() {
          feed.title = newTitle
        })
      }
    },
    deleteFeed: function(feed) {
      if (confirm('Are you sure you want to delete ' + feed.title + '?')) {
        api.feeds.delete(feed.id).then(function() {
          vm.feedSelected = null
          vm.refreshStats()
          vm.refreshFeeds()
        })
      }
    },
    createFeed: function(event) {
      var form = event.target
      var data = {
        url: form.querySelector('input[name=url]').value,
        folder_id: parseInt(form.querySelector('select[name=folder_id]').value) || null,
      }
      if (this.feedNewChoiceSelected) {
        data.url = this.feedNewChoiceSelected
      }
      this.loading.newfeed = true
      api.feeds.create(data).then(function(result) {
        if (result.status === 'success') {
          vm.refreshFeeds()
          vm.refreshStats()
          vm.settings = ''
          vm.feedSelected = 'feed:' + result.feed.id
        } else if (result.status === 'multiple') {
          vm.feedNewChoice = result.choice
          vm.feedNewChoiceSelected = result.choice[0].url
        } else {
          alert('No feeds found at the given url.')
        }
        vm.loading.newfeed = false
      })
    },
    toggleItemStatus: function(item, targetstatus, fallbackstatus) {
      var oldstatus = item.status
      var newstatus = item.status !== targetstatus ? targetstatus : fallbackstatus

      var updateStats = function(status, incr) {
        if ((status == 'unread') || (status == 'starred')) {
          this.feedStats[item.feed_id][status] += incr
        }
      }.bind(this)

      api.items.update(item.id, {status: newstatus}).then(function() {
        updateStats(oldstatus, -1)
        updateStats(newstatus, +1)

        var itemInList = this.items.find(function(i) { return i.id == item.id })
        if (itemInList) itemInList.status = newstatus
        item.status = newstatus
      }.bind(this))
    },
    toggleItemStarred: function(item) {
      this.toggleItemStatus(item, 'starred', 'read')
    },
    toggleItemRead: function(item) {
      this.toggleItemStatus(item, 'unread', 'read')
    },
    importOPML: function(event) {
      var input = event.target
      var form = document.querySelector('#opml-import-form')
      this.$refs.menuDropdown.hide()
      api.upload_opml(form).then(function() {
        input.value = ''
        vm.refreshFeeds()
        vm.refreshStats()
      })
    },
    logout: function() {
      api.logout().then(function() {
        document.location.reload()
      })
    },
    toggleReadability: function() {
      if (this.itemSelectedReadability) {
        this.itemSelectedReadability = null
        return
      }
      var item = this.itemSelectedDetails
      if (!item) return
      // deactivate summary view if currently shown
      if (this.itemSelectedSummary !== null) {
        this.cancelSummaryStream()
        this.itemSelectedSummary = null
      }
      if (item.link) {
        this.loading.readability = true
        api.crawl(item.link).then(function(data) {
          vm.itemSelectedReadability = data && data.content
          vm.loading.readability = false
        })
      }
    },
    cancelSummaryStream: function() {
      if (this.summaryAbortController) {
        try { this.summaryAbortController.abort() } catch (e) {}
      }
      this.summaryAbortController = null
      this.summaryInProgress = false
    },
    toggleSummary: function() {
      if (!this.aiConfigured) return
      var item = this.itemSelectedDetails
      if (!item) return

      // collapse if currently showing
      if (this.itemSelectedSummary !== null) {
        this.cancelSummaryStream()
        this.itemSelectedSummary = null
        return
      }
      // deactivate readability view
      this.itemSelectedReadability = null

      if (item.ai_summary) {
        this.itemSelectedSummary = item.ai_summary
        return
      }
      this.startSummaryStream(item.id)
    },
    startSummaryStream: function(id) {
      var self = this
      this.itemSelectedSummary = ''
      this.summaryInProgress = true
      this.summaryAbortController = api.items.summary_stream(id, {
        onDelta: function(text) {
          if (typeof text === 'string') self.itemSelectedSummary += text
        },
        onDone: function() {
          self.summaryInProgress = false
          self.summaryAbortController = null
          if (self.itemSelectedDetails && self.itemSelectedDetails.id === id) {
            self.itemSelectedDetails.ai_summary = self.itemSelectedSummary || ''
          }
        },
        onError: function(err) {
          self.summaryInProgress = false
          self.summaryAbortController = null
          self.itemSelectedSummary = null
          alert('Summary failed: ' + (err && err.message ? err.message : err))
        },
      })
    },
    regenerateSummary: function() {
      var item = this.itemSelectedDetails
      if (!item || !this.aiConfigured) return
      this.cancelSummaryStream()
      this.startSummaryStream(item.id)
    },
    showSettings: function(settings) {
      this.settings = settings

      if (settings === 'create') {
        vm.feedNewChoice = []
        vm.feedNewChoiceSelected = ''
      }
    },
    resizeFeedList: function(width) {
      this.feedListWidth = Math.min(Math.max(200, width), 700)
    },
    resizeItemList: function(width) {
      this.itemListWidth = Math.min(Math.max(200, width), 700)
    },
    resetFeedChoice: function() {
      this.feedNewChoice = []
      this.feedNewChoiceSelected = ''
    },
    incrFont: function(x) {
      this.theme.size = +(this.theme.size + (0.1 * x)).toFixed(1)
    },
    fetchAllFeeds: function() {
      if (this.loading.feeds) return
      api.feeds.refresh().then(function() {
        vm.refreshStats()
      })
    },
    onTabVisible: function() {
      if (this._tabSyncing) return
      this._tabSyncing = true
      var self = this
      this.refreshStats()
        .then(function() { return self.refreshItems(false) })
        .then(function() { self._tabSyncing = false })
        .catch(function() { self._tabSyncing = false })
    },
    computeStats: function() {
      var filter = this.filterSelected
      if (!filter) {
        this.filteredFeedStats = {}
        this.filteredFolderStats = {}
        this.filteredTotalStats = null
        return
      }

      var statsFeeds = {}, statsFolders = {}, statsTotal = 0

      for (var i = 0; i < this.feeds.length; i++) {
        var feed = this.feeds[i]
        if (!this.feedStats[feed.id]) continue

        var n = vm.feedStats[feed.id][filter] || 0

        if (!statsFolders[feed.folder_id]) statsFolders[feed.folder_id] = 0

        statsFeeds[feed.id] = n
        statsFolders[feed.folder_id] += n
        statsTotal += n
      }

      this.filteredFeedStats = statsFeeds
      this.filteredFolderStats = statsFolders
      this.filteredTotalStats = statsTotal
    },
    // navigation helper, navigate relative to selected item
    navigateToItem: function(relativePosition) {
      let vm = this
      if (vm.itemSelected == null) {
        // if no item is selected, select first
        if (vm.items.length !== 0) vm.itemSelected = vm.items[0].id
        return
      }

      var itemPosition = vm.items.findIndex(function(x) { return x.id === vm.itemSelected })
      if (itemPosition === -1) {
        if (vm.items.length !== 0) vm.itemSelected = vm.items[0].id
        return
      }

      var newPosition = itemPosition + relativePosition
      if (newPosition < 0 || newPosition >= vm.items.length) return

      vm.itemSelected = vm.items[newPosition].id

      vm.$nextTick(function() {
        var scroll = document.querySelector('#item-list-scroll')

        var handle = scroll.querySelector('input[type=radio]:checked')
        var target = handle && handle.parentElement

        if (target && scroll) scrollto(target, scroll)

        vm.loadMoreItems()
      })
    },
    // navigation helper, navigate relative to selected feed
    navigateToFeed: function(relativePosition) {
      let vm = this
      const navigationList = this.foldersWithFeeds
        .filter(folder => !folder.id || !vm.mustHideFolder(folder))
        .map((folder) => {
          if (this.mustHideFolder(folder)) return []
          const folds = folder.id ? [`folder:${folder.id}`] : []
          const feeds = (folder.is_expanded || !folder.id)
            ? (folder.feeds || []).filter(f => !vm.mustHideFeed(f)).map(f => `feed:${f.id}`)
            : []
          return folds.concat(feeds)
        })
        .flat()
      navigationList.unshift('')

      var currentFeedPosition = navigationList.indexOf(vm.feedSelected)

      if (currentFeedPosition == -1) {
        vm.feedSelected = ''
        return
      }

      var newPosition = currentFeedPosition+relativePosition
      if (newPosition < 0 || newPosition >= navigationList.length) return

      vm.feedSelected = navigationList[newPosition]

      vm.$nextTick(function() {
        var scroll = document.querySelector('#feed-list-scroll')

        var handle = scroll.querySelector('input[type=radio]:checked')
        var target = handle && handle.parentElement

        if (target && scroll) scrollto(target, scroll)
      })
    },
    changeRefreshRate: function(offset) {
      const curIdx = this.refreshRateOptions.findIndex(o => o.value === this.refreshRate)
      if (curIdx <= 0 && offset < 0) return
      if (curIdx >= (this.refreshRateOptions.length - 1) && offset > 0) return
      this.refreshRate = this.refreshRateOptions[curIdx + offset].value
    },
    mustHideFolder: function (folder) {
      return this.filterSelected
        && !(this.current.folder.id == folder.id || this.current.feed.folder_id == folder.id)
        && !this.filteredFolderStats[folder.id]
        && (!this.itemSelectedDetails || (this.feedsById[this.itemSelectedDetails.feed_id] || {}).folder_id != folder.id)
    },
    mustHideFeed: function (feed) {
      return this.filterSelected
        && !(this.current.feed.id == feed.id)
        && !this.filteredFeedStats[feed.id]
        && (!this.itemSelectedDetails || this.itemSelectedDetails.feed_id != feed.id)
    },
  }
})

vm.$mount('#app')
