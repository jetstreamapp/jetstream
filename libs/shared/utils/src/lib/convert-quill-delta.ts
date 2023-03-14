import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import pull from 'lodash/pull';
import type { DeltaOperation } from 'quill';

export function convertDeltaToMarkdown(ops: DeltaOperation[], converters = fromDeltaConverters) {
  return convert(ops, converters).render().trimEnd() + '\n';
}

const encodeLink = (link) =>
  encodeURI(link)
    .replace(/\(/i, '%28')
    .replace(/\)/i, '%29')
    .replace(/(\?|&)response-content-disposition=attachment.*$/, '');

let id = 0;

class Node {
  id: number;
  open: number;
  close: number;
  text: string;
  children: Node[];
  _parent: Node;

  constructor(data?: any) {
    this.id = ++id;
    if (isArray(data)) {
      this.open = data[0];
      this.close = data[1];
    } else if (isString(data)) {
      this.text = data;
    }
    this.children = [];
  }

  append(e: Node) {
    if (!(e instanceof Node)) {
      e = new Node(e);
    }
    if (e._parent) {
      pull(e._parent.children, e);
    }
    e._parent = this;
    this.children = this.children.concat(e);
  }

  render() {
    var text = '';
    if (this.open) {
      text += this.open;
    }
    if (this.text) {
      text += this.text;
    }
    for (var i = 0; i < this.children.length; i++) {
      text += this.children[i].render();
    }
    if (this.close) {
      text += this.close;
    }
    return text;
  }

  parent() {
    return this._parent;
  }
}

function convert(ops, converters) {
  var group, line, el, activeInline, beginningOfLine;
  var root = new Node();

  function newLine() {
    el = line = new Node(['', '\n']);
    root.append(line);
    activeInline = {};
  }
  newLine();

  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];

    if (isObject(op.insert)) {
      for (var k in op.insert) {
        if (converters.embed[k]) {
          applyInlineAttributes(op.attributes);
          converters.embed[k].call(el, op.insert[k], op.attributes);
        }
      }
    } else {
      var lines = op.insert.split('\n');

      if (hasBlockLevelAttribute(op.attributes, converters)) {
        // Some line-level styling (ie headings) is applied by inserting a \n
        // with the style; the style applies back to the previous \n.
        // There *should* only be one style in an insert operation.

        for (var j = 1; j < lines.length; j++) {
          for (var attr in op.attributes) {
            if (converters.block[attr]) {
              var fn = converters.block[attr];
              if (typeof fn === 'object') {
                if (group && group.type !== attr) {
                  group = null;
                }
                if (!group && fn.group) {
                  group = {
                    el: fn.group(),
                    type: attr,
                    value: op.attributes[k!],
                    distance: 0,
                    indent: 0,
                    indentCounts: [0],
                  };
                  root.append(group.el);
                }

                if (group) {
                  group.el.append(line);
                  group.distance = 0;
                }
                fn = fn.line;
              }

              fn.call(line, op.attributes, group);
              newLine();
              break;
            }
          }
        }
        beginningOfLine = true;
      } else {
        for (var l = 0; l < lines.length; l++) {
          if ((l > 0 || beginningOfLine) && group && ++group.distance >= 2) {
            group = null;
          }
          applyInlineAttributes(op.attributes, ops[i + 1] && ops[i + 1].attributes);
          el.append(lines[l]);
          if (l < lines.length - 1) {
            newLine();
          }
        }
        beginningOfLine = false;
      }
    }
  }

  return root;

  function applyInlineAttributes(attrs: any, next?: any) {
    const first: any[] = [];
    const then: any[] = [];
    attrs = attrs || {};

    var tag = el,
      seen = {};
    while (tag._format) {
      seen[tag._format] = true;
      if (!attrs[tag._format]) {
        for (var k in seen) {
          delete activeInline[k];
        }
        el = tag.parent();
      }

      tag = tag.parent();
    }

    for (var attr in attrs) {
      if (converters.inline[attr]) {
        if (activeInline[attr]) {
          if (activeInline[attr] === attrs[attr]) {
            continue; // do nothing -- we should already be inside this style's tag
          }
        }

        if (next && attrs[attr] === next[attr]) {
          first.push(attr); // if the next operation has the same style, this should be the outermost tag
        } else {
          then.push(attr);
        }
        activeInline[attr] = attrs[attr];
      }
    }

    first.forEach(apply);
    then.forEach(apply);

    function apply(fmt) {
      var newEl = converters.inline[fmt].call(null, attrs[fmt]);
      if (Array.isArray(newEl)) {
        newEl = new Node(newEl);
      }
      newEl._format = fmt;
      el.append(newEl);
      el = newEl;
    }
  }
}

function hasBlockLevelAttribute(attrs, converters) {
  for (var k in attrs) {
    if (Object.keys(converters.block).includes(k)) {
      return true;
    }
  }
  return false;
}

const fromDeltaConverters = {
  embed: {
    formula: function (src) {
      this.append('$$' + src + '$$');
    },
    image: function (src) {
      this.append(`![image](${encodeLink(src)})`);
    },
    // Not a default Quill feature, converts custom divider embed blot added when
    // creating quill editor instance.
    // See https://quilljs.com/guides/cloning-medium-with-parchment/#dividers
    thematic_break: function () {
      this.open = '\n---\n' + this.open;
    },
  },

  inline: {
    italic: function () {
      return ['_', '_'];
    },
    bold: function () {
      return ['**', '**'];
    },
    link: function (url) {
      return ['[', '](' + url + ')'];
    },
    code: function () {
      return ['`', '`'];
    },
    strikethrough: function () {
      return ['~~', '~~'];
    },
  },

  block: {
    header: function ({ header }) {
      this.open = '#'.repeat(header) + ' ' + this.open;
    },
    blockquote: function () {
      this.open = '> ' + this.open;
    },
    'code-block': {
      group: function () {
        return new Node(['```\n', '```\n']);
      },
      line: function (attrs, group) {
        // No specific line action
      },
    },
    list: {
      group: function () {
        return new Node(['', '\n']);
      },
      line: function (attrs, group) {
        let indent = '';

        if (attrs.indent) {
          indent = '    '.repeat(attrs.indent);
          group.indent = attrs.indent;
        } else {
          group.indent = 0;
        }

        if (attrs.list === 'bullet') {
          this.open = indent + '- ' + this.open;
        } else if (attrs.list === 'checked') {
          this.open = indent + '- [x] ' + this.open;
        } else if (attrs.list === 'unchecked') {
          this.open = indent + '- [ ] ' + this.open;
        } else if (attrs.list === 'ordered') {
          group.indentCounts[attrs.indent] = group.indentCounts[attrs.indent] || 0;
          let count = ++group.indentCounts[attrs.indent];
          this.open = indent + count + '. ' + this.open;
        }
      },
    },
  },
};
