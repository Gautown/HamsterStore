// Minimal stubs for GCC _Unwind_* personality routine references
// These are referenced by Rust GNU-compiled staticlibs that were
// compiled with panic=unwind. Provide dummy stubs so the binary
// links — the actual path will never be taken (the Rust objects
// themselves need these symbols for static linking resolution only).

void _Unwind_Resume(void* exc) { (void)exc; }
unsigned long long _Unwind_GetDataRelBase(void* ctx) { (void)ctx; return 0; }
unsigned long long _Unwind_GetTextRelBase(void* ctx) { (void)ctx; return 0; }
void* _Unwind_GetLanguageSpecificData(void* ctx) { (void)ctx; return 0; }
void* _Unwind_GetIPInfo(void* ctx, int* ip_before_insn) { (void)ctx; if(ip_before_insn) *ip_before_insn=0; return 0; }
unsigned long long _Unwind_GetRegionStart(void* ctx) { (void)ctx; return 0; }
void _Unwind_SetGR(void* ctx, int idx, unsigned long val) { (void)ctx; (void)idx; (void)val; }
void _Unwind_SetIP(void* ctx, unsigned long val) { (void)ctx; (void)val; }
