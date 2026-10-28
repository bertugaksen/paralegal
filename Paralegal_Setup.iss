; =====================================================================
; Paralegal - Windows Kurulum Sihirbazı Yapılandırması (Inno Setup 6)
; %100 Yerel, Sıfır İnternet, Sıfır Telemetri Hukuk Teknolojisi Paketi
; =====================================================================

#define MyAppName "Paralegal"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Paralegal Hukuk Teknolojileri"
#define MyAppSupportURL "mailto:antinkuntinyazilim@gmail.com"
#define MyAppExeName "Paralegal.exe"

[Setup]
; Benzersiz Uygulama Kimliği (GUID)
AppId={{8B1D4A2F-4389-4822-B8E5-3A2F1C74619E}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppSupportURL}
AppUpdatesURL={#MyAppSupportURL}

; Kurulum dizini: Yönetici yetkisi gerektirmeden kullanıcı dizinine kurulur
; Standart kullanıcılar (avukat, stajyer vb.) şifre girmeden kurabilir
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes

; Çıktı ayarları
OutputDir=dist_installer
OutputBaseFilename=Paralegal_Kurulum_v{#MyAppVersion}
SetupIconFile=assets\paralegal_icon.ico

; LZMA2 Ultra Solid Sıkıştırma (Dosya boyutunu maksimum oranda küçültür)
Compression=lzma2/ultra64
SolidCompression=yes

; Modern Kurulum Arayüzü & İzinler
WizardStyle=modern
DisableWelcomePage=no
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Kaldırma (Uninstall) Yapılandırması
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} - Hukuk Teknolojisi Asistanı

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Paralegal derlenmiş paket dosyaları
Source: "dist\Paralegal\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; İkon ve dökümantasyon
Source: "assets\paralegal_icon.ico"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "KULLANIM_KILAVUZU.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Başlat Menüsü ve Masaüstü Kısayolları
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\paralegal_icon.ico"
Name: "{group}\Kullanım Kılavuzu"; Filename: "{app}\KULLANIM_KILAVUZU.txt"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\paralegal_icon.ico"; Tasks: desktopicon

[Run]
; Kurulum tamamlandığında uygulamayı çalıştırma seçeneği
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
