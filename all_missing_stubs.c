// All needed stubs for HamsterStore GUI (MSVC) from GNU ext-http dependencies

// nanosleep (POSIX extension used by aws-lc)
int nanosleep64(const void* req, void* rem) { (void)req;(void)rem; return 0; }

// pthread stubs
typedef unsigned int pthread_key_t;
typedef void* (*pthread_destructor_t)(void*);
int pthread_key_create(pthread_key_t* k, pthread_destructor_t d) { *k=0; (void)d; return 0; }
int pthread_key_delete(pthread_key_t k) { (void)k; return 0; }
void* pthread_getspecific(pthread_key_t k) { (void)k; return 0; }
int pthread_setspecific(pthread_key_t k, const void* v) { (void)k;(void)v; return 0; }
int pthread_once(void* o, void (*i)(void)) { (void)o; if(i)i(); return 0; }
int pthread_mutex_lock(void* m) { (void)m; return 0; }
int pthread_mutex_unlock(void* m) { (void)m; return 0; }
int pthread_rwlock_destroy(void* r) { (void)r; return 0; }
int pthread_rwlock_init(void* r, void* a) { (void)r; (void)a; return 0; }
int pthread_rwlock_rdlock(void* r) { (void)r; return 0; }
int pthread_rwlock_tryrdlock(void* r) { (void)r; return 0; }
int pthread_rwlock_unlock(void* r) { (void)r; return 0; }
int pthread_rwlock_wrlock(void* r) { (void)r; return 0; }
int sched_yield(void) { return 0; }

// MinGW CRT stubs
int __mingw_sscanf(const char* s, const char* fmt, ...) { (void)s;(void)fmt; return 0; }
int __mingw_fprintf(void* f, const char* fmt, ...) { (void)f;(void)fmt; return 0; }
int __mingw_snprintf(char* buf, unsigned int sz, const char* fmt, ...) { (void)buf;(void)sz;(void)fmt; return 0; }
int __mingw_vsnprintf(char* buf, unsigned int sz, const char* fmt, ...) { (void)buf;(void)sz;(void)fmt; return 0; }

// GCC Unwind stubs
void _Unwind_Resume(void* e) { (void)e; }
void _Unwind_RaiseException(void* e) { (void)e; }
void _Unwind_DeleteException(void* e) { (void)e; }
unsigned long long _Unwind_GetDataRelBase(void* c) { (void)c; return 0; }
unsigned long long _Unwind_GetTextRelBase(void* c) { (void)c; return 0; }
void* _Unwind_GetLanguageSpecificData(void* c) { (void)c; return 0; }
void* _Unwind_GetIPInfo(void* c, int* ip) { (void)c; if(ip)*ip=0; return 0; }
unsigned long long _Unwind_GetRegionStart(void* c) { (void)c; return 0; }
void _Unwind_SetGR(void* c, int i, unsigned long v) { (void)c;(void)i;(void)v; }
void _Unwind_SetIP(void* c, unsigned long v) { (void)c;(void)v; }
void _GCC_specific_handler(void) {}

// HTTP stub for GUI-only context
void* js_node_http_create_server_with_options(void* rt, void* opts) { (void)rt;(void)opts; return 0; }
