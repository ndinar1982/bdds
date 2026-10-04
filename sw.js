// Служебный скрипт пусковой страницы: держит в кэше её собственные файлы (сама страница, иконки),
// чтобы приложение открывалось быстро. Данные семьи сюда не попадают — они загружаются из Google.
var CACHE='bdds-shell-v1';
var FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES)}).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
// только файлы этой страницы: сначала сеть (чтобы обновления подхватывались), без сети — из кэша
self.addEventListener('fetch',function(e){
  var url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith(fetch(e.request).then(function(r){
    var copy=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy)});return r;
  }).catch(function(){return caches.match(e.request,{ignoreSearch:true})}));
});
