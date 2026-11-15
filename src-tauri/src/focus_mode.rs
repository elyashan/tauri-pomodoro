use std::sync::atomic::{AtomicBool, Ordering};

static FOCUS_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Çalışma sayacı aktifken Windows "Rahatsız Etmeyin / Odaklanma Yardımı" (Focus Assist)
/// modunu açar ve masaüstü bildirim balonlarını (Toast) susturur.
/// Mola verildiğinde, sayaç durdurulduğunda veya uygulamadan çıkıldığında eski haline döndürür.
pub fn set_focus_mode(enabled: bool) {
    let prev = FOCUS_MODE_ACTIVE.swap(enabled, Ordering::SeqCst);
    if prev == enabled {
        return;
    }
    platform::apply_windows_focus_mode(enabled);
}

pub fn restore_focus_mode_on_exit() {
    if FOCUS_MODE_ACTIVE.swap(false, Ordering::SeqCst) {
        platform::apply_windows_focus_mode(false);
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::ffi::c_void;
    use std::ptr;

    const HKEY_CURRENT_USER: isize = -2147483647i32 as isize; // 0x80000001
    const KEY_SET_VALUE: u32 = 0x0002;
    const REG_OPTION_NON_VOLATILE: u32 = 0x00000000;
    const REG_DWORD: u32 = 4;

    // WNF_SHEL_QUIETHOURS_ACTIVE_PROFILE_CHANGED
    const WNF_QUIETHOURS: [u32; 2] = [0xA3BF1C75, 0x0D83063E];

    #[link(name = "ntdll")]
    unsafe extern "system" {
        fn NtUpdateWnfStateData(
            state_name: *const [u32; 2],
            buffer: *const c_void,
            length: u32,
            type_id: *const c_void,
            explicit_scope: *const c_void,
            matching_change_stamp: u32,
            check_stamp: u32,
        ) -> i32;
    }

    #[link(name = "advapi32")]
    unsafe extern "system" {
        fn RegCreateKeyExW(
            hkey: isize,
            sub_key: *const u16,
            reserved: u32,
            class: *const u16,
            options: u32,
            sam_desired: u32,
            security_attributes: *const c_void,
            result: *mut isize,
            disposition: *mut u32,
        ) -> i32;

        fn RegSetValueExW(
            hkey: isize,
            value_name: *const u16,
            reserved: u32,
            dw_type: u32,
            data: *const u8,
            cb_data: u32,
        ) -> i32;

        fn RegCloseKey(hkey: isize) -> i32;
    }

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn set_hkcu_dword(subkey: &str, value_name: &str, val: u32) {
        let subkey_w = to_wide(subkey);
        let val_name_w = to_wide(value_name);
        let mut hkey: isize = 0;
        let status = unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                subkey_w.as_ptr(),
                0,
                ptr::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_SET_VALUE,
                ptr::null(),
                &mut hkey,
                ptr::null_mut(),
            )
        };
        if status == 0 && hkey != 0 {
            let bytes = val.to_ne_bytes();
            let _ = unsafe {
                RegSetValueExW(
                    hkey,
                    val_name_w.as_ptr(),
                    0,
                    REG_DWORD,
                    bytes.as_ptr(),
                    4,
                )
            };
            let _ = unsafe { RegCloseKey(hkey) };
        }
    }

    pub fn apply_windows_focus_mode(enabled: bool) {
        unsafe {
            // 1. Windows 10/11 Odaklanma Yardımı / Rahatsız Etmeyin (WNF Quiet Hours)
            // 2 = Yalnızca Alarmlar (Rahatsız Etmeyin Açık), 0 = Kapalı (Normal)
            let profile: u32 = if enabled { 2 } else { 0 };
            let _ = NtUpdateWnfStateData(
                &WNF_QUIETHOURS,
                &profile as *const u32 as *const c_void,
                std::mem::size_of::<u32>() as u32,
                ptr::null(),
                ptr::null(),
                0,
                0,
            );

            // 2. Masaüstü Bildirim Balonlarını (Toast) Aç/Kapat
            let toast_val: u32 = if enabled { 0 } else { 1 };
            set_hkcu_dword(
                "Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications",
                "ToastEnabled",
                toast_val,
            );
            set_hkcu_dword(
                "Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings",
                "NOC_GLOBAL_SETTING_TOASTS_ENABLED",
                toast_val,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    pub fn apply_windows_focus_mode(_enabled: bool) {}
}
