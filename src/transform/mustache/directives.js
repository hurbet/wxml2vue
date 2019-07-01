/**
 * `wx:xxx` 预转换
 */
const assert = require('assert')
const mustache = require('mustache')
const { defaults, omit } = require('lodash')
const visit = require('unist-util-visit')

const reWxDirective = /^wx:[a-z]+/
const isWxDirective = key => reWxDirective.test(key)
const stripPrefix = key => key.slice(3)

const stringDirectives = [
  'wx:for-item',
  'wx:for-index',
  // TODO treat reserved `wx:key="{{*this}}"`
  'wx:key'
]

const directiveMap = {
  'wx:if': 'v-if',
  'wx:elif': 'v-else-if',
  'wx:else': 'v-else'
}

module.exports = function() {
  return transformer

  function transformer(tree) {
    visit(tree, 'element', visitor)
  }

  function visitor(node) {
    const { properties } = node

    /* istanbul ignore next */
    if (!properties) return

    const keys = Object.keys(properties).filter(isWxDirective)

    /* istanbul ignore next */
    if (!keys.length) return

    let directives = keys.reduce((acc, key) => {
      const value = properties[key]
      let newKey = directiveMap[key] || stripPrefix(key)

      // following are totally string and cannot be dynamic value
      if (stringDirectives.includes(key)) {
        return { ...acc, [newKey]: value }
      }

      const result = mustache.parse(value)
      assert(
        result.every(([type]) => type === 'name' || type === 'text'),
        'Oooooooops, unexpected mustache parsing result:' + result.toString()
      )

      if (result.length === 0) {
        return { ...acc, [newKey]: '' }
      }

      if (result.length === 1) {
        const [type, value] = result[0]
        if (type === 'name') {
          return { ...acc, [newKey]: value }
        }
        if (type === 'text') {
          return { ...acc, [newKey]: `'${value}'` }
        }
      }

      const segments = result.map(([type, value]) => {
        if (type === 'name') {
          return `\${${value}}`
        }
        return value
      })

      return { ...acc, [newKey]: `\`${segments.join('')}\`` }
    }, {})

    if ('for' in directives) {
      defaults(directives, {
        'for-item': 'item',
        'for-index': 'index'
      })
    }

    node.directives = directives
    node.properties = omit(properties, ...keys)
  }
}
