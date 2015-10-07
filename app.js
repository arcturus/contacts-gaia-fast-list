'use strict';

(function(exports) {

  var list = document.querySelector('gaia-fast-list');

  var stringToColour = function(str) {
    var base = [82, 186, 209];
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var colour = '#';
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xFF;
        value = parseInt((value + base[i])/ 2);
        colour += ('00' + value.toString(16)).substr(-2);
    }
    return colour;
  }

  list.configure({
    getSectionName: getSectionName,
    getItemImageSrc: getImage
  });

  list.addEventListener('click', evt => {
    var li = evt.target.closest('li');
    if (!li) {
      return;
    }
    var contactId = li.dataset.id;

    console.log('Contact id: ' + contactId);
  });

  function getImage(data, index) {
    if (data.image === null) {
      return null;
    }

    return window.URL.createObjectURL(data.image);
  }

  function getSectionName(item) {
    return item.title[0].toLowerCase();
  }

  function hasName(contact) {
    return (Array.isArray(contact.givenName) && contact.givenName[0] &&
              contact.givenName[0].trim()) ||
            (Array.isArray(contact.familyName) && contact.familyName[0] &&
              contact.familyName[0].trim());
  };

  function getDisplayName(contact) {
    if (hasName(contact)) {
      return { givenName: contact.givenName, familyName: contact.familyName };
    }

    var givenName = [];
    if (contact.org && contact.org.length > 0) {
      givenName.push(contact.org[0]);
    } else if (contact.tel && contact.tel.length > 0) {
      givenName.push(contact.tel[0].value);
    } else if (contact.email && contact.email.length > 0) {
      givenName.push(contact.email[0].value);
    } else {
      givenName.push('No name');
    }

    return { givenName: givenName, modified: true };
  };

  function getRowTitle(contact) {
    var parsed = getDisplayName(contact);

    var result = [parsed.givenName.join(' ')];

    if (parsed.familyName) {
      result.push(parsed.familyName.join(' '));
    }

    return result.join(' ');
  }

  function appendToList(data) {
    list.model = data;
  }

  function getOrg(contact) {
    var org = contact.org;
    if (Array.isArray(org) && org.length > 0) {
      return org[0];
    }

    return '';
  }

  function getInitials(rowTitle) {
    var result = rowTitle[0].toUpperCase();
    var split = rowTitle.split(' ');
    if (split.length > 1 && split[1].length > 0) {
      result += split[1][0].toUpperCase();
    }
    return result;
  }

  function fetchAllContacts() {
    var options = {
      sortBy: 'givenName',
      sortOrder: 'ascending'
    };
    var index = 0;
    var resolve, reject;
    var deferred = new Promise(function(res, rej) {
      resolve = res;
      reject = rej;
    });
    var cursor = navigator.mozContacts.getAll(options);
    var CHUNK = 10;
    var firstChunkReady = false;
    var buffer = [];
    cursor.onsuccess = function onsuccess(evt) {
      var contact = evt.target.result;
      if (contact) {
        var rowTitle = getRowTitle(contact) || 'No name';
        var row = {
          id: contact.id,
          title: rowTitle,
          org: getOrg(contact),
          background: stringToColour(rowTitle)
        };
        index++;
        row.initials = getInitials(row.title);
        if (Array.isArray(contact.photo) && contact.photo.length > 0) {
          row.image = contact.photo[contact.photo.length > 1 ? 1: 0];
        } else {
          row.image = null;
        }
        buffer.push(row);
        if (firstChunkReady && index % CHUNK === 0) {
          // Append a chunk
          appendToList(buffer);
          //buffer = [];
        }

        if (!firstChunkReady && index >= CHUNK) {
          performance.measure('first_chunk');
          firstChunkReady = true;
          // After first chunk increase the chunk to 50
          CHUNK = 50;
        }

        cursor.continue();
      } else {
        console.log('Finished loading ', index);
        performance.measure('all_contacts');
        if (index % CHUNK > 0) {
          // Append chunk
          appendToList(buffer);
          //buffer = [];
        }
        resolve();
      }
    };
    cursor.onerror = function onerror(err) {
      console.error('Error: ', err);
      reject();
    };
    return deferred;
  }

  function start() {
    return fetchAllContacts().then(() => {
      list.complete();
    });
  }

  exports.ContactsList = {
    start: start
  }
})(window);

document.addEventListener('DOMContentLoaded', () => {
  ContactsList.start();
});
