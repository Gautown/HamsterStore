// stubs for MinGW symbols (never actually called in GUI — MSVC uses Win32 threads)

// GCC Unwind
void _Unwind_RaiseException(void* e) { (void)e; }
void _Unwind_DeleteException(void* e) { (void)e; }
__attribute__((weak)) void _GCC_specific_handler(void) {}

// pthread stubs
typedef unsigned int pthread_key_t;
typedef void* (*pthread_destructor_t)(void*);
int pthread_key_create(pthread_key_t* k, pthread_destructor_t d) { *k=0; (void)d; return 0; }
void* pthread_getspecific(pthread_key_t k) { (void)k; return 0; }
int pthread_once(void* o, void (*i)(void)) { (void)o; if(i)i(); return 0; }
int pthread_mutex_lock(void* m) { (void)m; return 0; }
int pthread_mutex_unlock(void* m) { (void)m; return 0; }
int pthread_rwlock_destroy(void* r) { (void)r; return 0; }
int pthread_rwlock_init(void* r, void* a) { (void)r; (void)a; return 0; }
int pthread_rwlock_rdlock(void* r) { (void)r; return 0; }
int pthread_rwlock_tryrdlock(void* r) { (void)r; return 0; }
int pthread_rwlock_unlock(void* r) { (void)r; return 0; }
int pthread_rwlock_wrlock(void* r) { (void)r; return 0; }

// sched
int sched_yield(void) { return 0; }

// MinGW CRT
int __mingw_sscanf(const char* s, const char* fmt, ...) { (void)s;(void)fmt; return 0; }
int __mingw_fprintf(void* f, const char* fmt, ...) { (void)f;(void)fmt; return 0; }
int __mingw_snprintf(char* buf, unsigned int sz, const char* fmt, ...) { (void)buf;(void)sz;(void)fmt; return 0; }
int __mingw_vsnprintf(char* buf, unsigned int sz, const char* fmt, ...) { (void)buf;(void)sz;(void)fmt; return 0; }
