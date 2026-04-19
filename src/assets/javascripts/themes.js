'use strict';

window.yarrLuminance = function(hex) {
  var r = parseInt(hex.slice(1, 3), 16) / 255
  var g = parseInt(hex.slice(3, 5), 16) / 255
  var b = parseInt(hex.slice(5, 7), 16) / 255
  function chan(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
}

window.yarrContrastText = function(hex) {
  return window.yarrLuminance(hex) > 0.5 ? '#111111' : '#eeeeee'
}

window.yarrFindEntry = function(list, key) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].key === key) return list[i].value
  }
  return (list[0] && list[0].value) || '#000000'
}

window.yarrResolveTheme = function(mode, lightKey, darkKey, accentKey) {
  var t = window.yarrThemes
  var bg
  if (mode === 'dark') {
    bg = window.yarrFindEntry(t.dark, darkKey)
  } else {
    bg = window.yarrFindEntry(t.light, lightKey)
    mode = 'light'
  }
  var accent = window.yarrFindEntry(t.accents, accentKey)
  return {
    mode: mode,
    bg: bg,
    text: window.yarrContrastText(bg),
    accent: accent,
    accentText: window.yarrContrastText(accent),
  }
}
