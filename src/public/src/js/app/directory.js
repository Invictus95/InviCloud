var Format = new _Format()
var Storage = new _Storage()

function _Directory () {
  var self = this
  this.body = $('.list table tbody')
  this.table = $('.list table')
  this.size = $('.top-menu .folder-size')
  this.table = $('.list')
  this.actions = {
    download: $('.top-menu .action #download'),
    rename: $('.top-menu .action #rename'),
    remove: $('.top-menu .action #remove'),
    info: $('.top-menu .action #info')
  }

  this.timer = null
  this.refresh = 30000

  $(window).bind('hashchange', function () {
    self.getList()
    self.setActions('', {
      download: false,
      rename: false,
      remove: false,
      info: false
    })
  }).trigger('hashchange')
}

_Directory.prototype.appendSize = function (size) {
  this.size.text(Format.size(size))
}

_Directory.prototype.getList = function () {
  var hash = document.location.hash.substring(1) ? document.location.hash.substring(1) : '/'
  var self = this
  $.post('/list-d', {
    dir: hash
  }, function (directory) {
    directory = JSON.parse(directory)
    if (directory.err) {
      var notif = new Pnotif()
      notif.init('top-right', "<p style='padding: 10px; margin: 0px; color:red;'>Action impossible: " + directory.err + '</p>', 10000)
      notif.draw()
    } else {
      self.appendSize(directory.totalSize)

      var current_scroll = $('body').scrollTop()

      self.body.html('')
      self.list(directory.files)

      $('body').scrollTop(current_scroll)

    }
  })
  clearTimeout(this.timer)
  this.timer = setTimeout(function () {
    self.getList()
  }, this.refresh)
}

_Directory.prototype.list = function (directory) {
  var kownFiles = Storage.readData('directory') ? Storage.readData('directory') : [] // array

  //...
  var href = document.location.hash.substring(1).split('\/')
  href.splice(href.length-2 || 0, 1)
  href = href.join('\/')
  this.append({new: false, name: "..", href: href, isfile: false, isdir: true, })

  for (var key in directory) {
    var file = directory[key]
    file.name = key
    file.href = document.location.hash.substring(1) + file.name + '/';
    if (kownFiles.indexOf(file.name) == -1) {
      file.new = true
      kownFiles.push(file.name)
    } else {
      file.new = false
    }
    this.append(file)
  }
  Storage.storeData('directory', kownFiles)
}

_Directory.prototype.append = function (file) {
  var self = this
  var $raw = $('<tr>').addClass(file.new ? 'file button new' : 'file button').attr('data-file', file.name).click(function (event) {
    event.stopPropagation()
    $('.list .file').removeClass('selected')
    $(this).addClass('selected')

    self.setActions(file, {
      download: file.isfile ? true : false,
      rename: true,
      remove: true,
      info: file.isfile ? true : false
    })

    $(this).children('#name').draggable({
      revert: true
    })
  })

  var $name = $('<td>').attr('id', 'name').attr('extension', Format.extention(file)).attr('data-file', file.name).html(
    file.isdir ?
      $('<a>').addClass('button').attr('href', '#' + file.href).text(file.name) :
      file.name).appendTo($raw)
  if (file.isdir)
    $name.droppable({
      greedy: true,
      drop: function (data) {
        var folder = $(this).attr('data-file')
        var file = $(data.toElement).attr('data-file') || $(data.toElement).parent().attr('data-file')
        var path = document.location.hash.substring(1) ? document.location.hash.substring(1) : '/'

        $.post('/mv-d', {
          'file': file,
          'path': path,
          'folder': folder
        }, function (file) {
          file = JSON.parse(file)
          if (file.err) {
            var notif = new Pnotif()
            notif.init('top-right', "<p style='padding: 10px; margin: 0px; color:red;'>Action impossible: " + file.err + '</p>', 10000)
            notif.draw()
          } else {
            $('tr[data-file="' + file.file + '"]').remove()
          }
        })
      }
    })

  // drag and drop

  var $size = $('<td>').attr('id', 'size').text(Format.size(file.size)).appendTo($raw)
  var $date = $('<td>').attr('id', 'date').text(Format.date(file.ctime)).appendTo($raw)

  this.body.append($raw)
  $('.list table').trigger('update')
}

_Directory.prototype.setActions = function (file, actions) {
  for (var key in this.actions) {
    this.actions[key].addClass('hide').unbind()
  }
  if (actions.download) {
    this.actions.download.removeClass('hide')
    this.actions.download.parent().attr('href', 'files/?f=' + document.location.hash.substring(1) + file.name)
  }
  if (actions.rename) {
    this.actions.rename.removeClass('hide').click(function () {
      var oldname = file.name.split('.')
      if (oldname.length > 1) {
        var extension = oldname.pop()
        extension = extension.length > 0 ? '.' + extension : ''
      } else {
        var extension = ''
      }
      var name = prompt('New name for: ' + oldname.join(' '), oldname.join(' '))
      if (name) {
        name = name.split('\/').pop() + extension
        $.post('/rename-d', {
          'path': document.location.hash.substring(1) ? document.location.hash.substring(1) : '/',
          'oldname': file.name,
          'newname': name
        }, function (data) {
          data = JSON.parse(data)
          if (data.err) {
            var notif = new Pnotif()
            notif.init('top-right', "<p style='padding: 10px; margin: 0px; color:red;'>Action impossible: " + data.err + '</p>', 10000)
            notif.draw()
          } else {
            file.name = data.newname
            $('tr[data-file="' + data.oldname + '"] td#name').attr('data-file', data.newname).html(
              file.isdir ?
                $('<a>').attr('href', '#' + document.location.hash.substring(1) + data.newname + '/').text(data.newname.substring(0, 50)) :
                data.newname.substring(0, 30)
            )
            $('tr[data-file="' + data.oldname + '"]').attr('data-file', data.newname)
          }
        })
      }
    })

  }
  if (actions.remove) {
    this.actions.remove.removeClass('hide').click(function () {
      if (confirm('Confirmer la suppression de ' + file.name + ' ?'))
        $.post('/remove-d', {
          file: document.location.hash.substring(1) + file.name
        }, function (file) {
          file = JSON.parse(file)
          if (file.err) {
            var notif = new Pnotif()
            notif.init('top-right', "<p style='padding: 10px; margin: 0px; color:red;'>Action impossible: " + file.err + '</p>', 10000)
            notif.draw()
          } else {
            $('tr[data-file="' + file.file + '"]').remove()
          }
        })
    })
  }
  if (actions.info) {
    this.actions.info.removeClass('hide').click(function () {
      var info = new _MediaInfo()
      info.get(file.name)
    })
  }
}
