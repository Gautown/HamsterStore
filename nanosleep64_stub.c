// aws-lc 0.41 thread_pthread.c needs nanosleep64() which its pthread_compat
// shim normally defines; the MinGW build of aws-lc inside perry-ext-http did
// not link that shim, so we provide a Windows-native replacement here.
#include <windows.h>

// aws-lc's internal timespec64 layout (matching thread_pthread.c):
typedef struct { long tv_sec; long long tv_nsec; } aws_timespec64;

int nanosleep64(const aws_timespec64 *req, aws_timespec64 *rem) {
    (void)rem;
    if (!req) return -1;
    long long ms = (long long)req->tv_sec * 1000LL + req->tv_nsec / 1000000LL;
    if (ms < 1) ms = 1;
    if (ms > 0xFFFFFFFFLL) ms = 0xFFFFFFFFLL;
    Sleep((DWORD)ms);
    return 0;
}
