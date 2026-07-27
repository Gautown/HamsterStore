int nanosleep64(const void* req, void* rem) { (void)req;(void)rem; return 0; }

typedef unsigned int pthread_key_t;
int pthread_setspecific(unsigned int k, const void* v) { (void)k;(void)v; return 0; }
int pthread_key_delete(unsigned int k) { (void)k; return 0; }
