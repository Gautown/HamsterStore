// 平台识别规则（文档§4.4）
// 按 Release 文件后缀名自动区分 Windows/macOS/Linux

export type PlatformType = 'windows' | 'macos' | 'linux' | 'universal';

export interface PlatformRule {
    platform: PlatformType;
    extensions: string[];   // 精准匹配后缀
    keywords: string[];     // 压缩包关键词匹配
}

export const PLATFORM_RULES: PlatformRule[] = [
    {
        platform: 'windows',
        extensions: ['.exe', '.msi', '.bat', '.cmd', '.ps1'],
        keywords: ['win', 'windows', 'x64', 'x86', 'win32', 'win64'],
    },
    {
        platform: 'macos',
        extensions: ['.dmg', '.pkg'],
        keywords: ['mac', 'osx', 'darwin', 'arm64', 'apple', 'macos'],
    },
    {
        platform: 'linux',
        extensions: ['.deb', '.rpm', '.appimage', '.pacman'],
        keywords: ['linux', 'ubuntu', 'centos', 'debian', 'fedora', 'arch'],
    },
];

// 压缩包后缀列表（用于第二优先级匹配）
export const ARCHIVE_EXTENSIONS: string[] = ['.zip', '.tar.gz', '.7z', '.tar.xz', '.tar.bz2', '.tgz'];

// 通用/源码分类
export const UNIVERSAL_PLATFORM: PlatformType = 'universal';