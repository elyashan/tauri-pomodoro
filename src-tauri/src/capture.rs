use serde::{Deserialize, Serialize};
use std::sync::Mutex;

use crate::active_window::inspect_external_foreground;
use crate::{lock_state, SharedCaptureState};

pub const DEFAULT_CAPTURE_MAX_WIDTH: i32 = 840;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotCapturePayload {
    pub data_url: String,
    pub active_app: String,
    pub active_window: String,
}

pub fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[((triple >> 18) & 0x3F) as usize]);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize]);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3F) as usize]);
        } else {
            out.push(b'=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3F) as usize]);
        } else {
            out.push(b'=');
        }
    }
    // SAFETY: TABLE and '=' are valid ASCII bytes
    unsafe { String::from_utf8_unchecked(out) }
}

pub fn capture_screen_data_url(max_width: i32) -> Option<String> {
    platform::capture_screen_data_url(max_width)
}

pub fn capture_snapshot(
    state: &Mutex<SharedCaptureState>,
    fresh: bool,
) -> ScreenshotCapturePayload {
    if fresh {
        let fresh_fg = inspect_external_foreground();
        let shot = capture_screen_data_url(DEFAULT_CAPTURE_MAX_WIDTH).unwrap_or_default();
        let mut guard = lock_state(state);
        if let Some((info, hwnd)) = fresh_fg {
            guard.update_external(info, hwnd);
        }
        if !shot.is_empty() {
            guard.last_screenshot_data_url = shot.clone();
        }
        return ScreenshotCapturePayload {
            data_url: shot,
            active_app: guard.last_external.app_name.clone(),
            active_window: guard.last_external.window_title.clone(),
        };
    }

    let (cached_shot, app_name, win_title) = {
        let guard = lock_state(state);
        (
            guard.last_screenshot_data_url.clone(),
            guard.last_external.app_name.clone(),
            guard.last_external.window_title.clone(),
        )
    };

    if !cached_shot.is_empty() {
        return ScreenshotCapturePayload {
            data_url: cached_shot,
            active_app: app_name,
            active_window: win_title,
        };
    }

    let shot = capture_screen_data_url(DEFAULT_CAPTURE_MAX_WIDTH).unwrap_or_default();
    if !shot.is_empty() {
        lock_state(state).last_screenshot_data_url = shot.clone();
    }
    ScreenshotCapturePayload {
        data_url: shot,
        active_app: app_name,
        active_window: win_title,
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::encode_base64;

    type HWND = isize;
    type HDC = isize;
    type HGDIOBJ = isize;
    type HBITMAP = isize;
    type DWORD = u32;
    type BOOL = i32;

    const SRCCOPY: DWORD = 0x00CC0020;
    const HALFTONE: i32 = 4;
    const DESKTOPVERTRES: i32 = 117;
    const DESKTOPHORZRES: i32 = 118;
    const BMP_FILE_HEADER_SIZE: usize = 14;
    const BMP_INFO_HEADER_SIZE: usize = 40;
    const BMP_HEADER_OFFSET: usize = BMP_FILE_HEADER_SIZE + BMP_INFO_HEADER_SIZE;

    #[repr(C)]
    struct BitmapInfoHeader {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetDC(hWnd: HWND) -> HDC;
        fn ReleaseDC(hWnd: HWND, hDC: HDC) -> i32;
        fn GetSystemMetrics(nIndex: i32) -> i32;
    }

    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn GetDeviceCaps(hdc: HDC, index: i32) -> i32;
        fn CreateCompatibleDC(hdc: HDC) -> HDC;
        fn CreateCompatibleBitmap(hdc: HDC, cx: i32, cy: i32) -> HBITMAP;
        fn SelectObject(hdc: HDC, h: HGDIOBJ) -> HGDIOBJ;
        fn SetStretchBltMode(hdc: HDC, mode: i32) -> i32;
        fn StretchBlt(
            hdcDest: HDC,
            xDest: i32,
            yDest: i32,
            wDest: i32,
            hDest: i32,
            hdcSrc: HDC,
            xSrc: i32,
            ySrc: i32,
            wSrc: i32,
            hSrc: i32,
            rop: DWORD,
        ) -> BOOL;
        fn GetDIBits(
            hdc: HDC,
            hbmp: HBITMAP,
            start: u32,
            cLines: u32,
            lpvBits: *mut u8,
            lpbmi: *mut BitmapInfoHeader,
            usage: u32,
        ) -> i32;
        fn DeleteObject(ho: HGDIOBJ) -> BOOL;
        fn DeleteDC(hdc: HDC) -> BOOL;
    }

    struct GdiSession {
        hdc_screen: HDC,
        hdc_mem: HDC,
        hbm: HBITMAP,
        old_obj: HGDIOBJ,
    }

    impl GdiSession {
        fn new(hdc_screen: HDC) -> Self {
            Self {
                hdc_screen,
                hdc_mem: 0,
                hbm: 0,
                old_obj: 0,
            }
        }
    }

    impl Drop for GdiSession {
        fn drop(&mut self) {
            unsafe {
                if self.old_obj != 0 && self.hdc_mem != 0 {
                    let _ = SelectObject(self.hdc_mem, self.old_obj);
                }
                if self.hbm != 0 {
                    let _ = DeleteObject(self.hbm);
                }
                if self.hdc_mem != 0 {
                    let _ = DeleteDC(self.hdc_mem);
                }
                if self.hdc_screen != 0 {
                    let _ = ReleaseDC(0, self.hdc_screen);
                }
            }
        }
    }

    pub fn capture_screen_data_url(max_width: i32) -> Option<String> {
        unsafe {
            let hdc_screen = GetDC(0);
            if hdc_screen == 0 {
                return None;
            }
            let mut gdi = GdiSession::new(hdc_screen);

            let mut src_w = GetDeviceCaps(gdi.hdc_screen, DESKTOPHORZRES);
            let mut src_h = GetDeviceCaps(gdi.hdc_screen, DESKTOPVERTRES);
            if src_w <= 0 || src_h <= 0 {
                src_w = GetSystemMetrics(0);
                src_h = GetSystemMetrics(1);
            }
            if src_w <= 0 || src_h <= 0 {
                return None;
            }

            let target_w = max_width.clamp(320, 1280).min(src_w);
            let target_h = ((src_h as i64 * target_w as i64) / src_w as i64).max(180) as i32;

            gdi.hdc_mem = CreateCompatibleDC(gdi.hdc_screen);
            if gdi.hdc_mem == 0 {
                return None;
            }

            gdi.hbm = CreateCompatibleBitmap(gdi.hdc_screen, target_w, target_h);
            if gdi.hbm == 0 {
                return None;
            }

            gdi.old_obj = SelectObject(gdi.hdc_mem, gdi.hbm);
            let _ = SetStretchBltMode(gdi.hdc_mem, HALFTONE);
            let ok_blt = StretchBlt(
                gdi.hdc_mem,
                0,
                0,
                target_w,
                target_h,
                gdi.hdc_screen,
                0,
                0,
                src_w,
                src_h,
                SRCCOPY,
            );
            if ok_blt == 0 {
                return None;
            }

            let row_stride = ((target_w as usize * 3 + 3) / 4) * 4;
            let image_size = row_stride * target_h as usize;
            let total_size = BMP_HEADER_OFFSET + image_size;
            let mut bmp_buf = vec![0u8; total_size];

            // 14-byte BITMAPFILEHEADER
            bmp_buf[0] = b'B';
            bmp_buf[1] = b'M';
            bmp_buf[2..6].copy_from_slice(&(total_size as u32).to_le_bytes());
            bmp_buf[10..14].copy_from_slice(&(BMP_HEADER_OFFSET as u32).to_le_bytes());

            let mut bmi = BitmapInfoHeader {
                bi_size: BMP_INFO_HEADER_SIZE as u32,
                bi_width: target_w,
                bi_height: target_h, // bottom-up standard BMP
                bi_planes: 1,
                bi_bit_count: 24,
                bi_compression: 0,
                bi_size_image: image_size as u32,
                bi_x_pels_per_meter: 0,
                bi_y_pels_per_meter: 0,
                bi_clr_used: 0,
                bi_clr_important: 0,
            };

            let lines = GetDIBits(
                gdi.hdc_mem,
                gdi.hbm,
                0,
                target_h as u32,
                bmp_buf[BMP_HEADER_OFFSET..].as_mut_ptr(),
                &mut bmi,
                0,
            );

            // Copy BITMAPINFOHEADER into bytes 14..54
            bmp_buf[14..18].copy_from_slice(&bmi.bi_size.to_le_bytes());
            bmp_buf[18..22].copy_from_slice(&bmi.bi_width.to_le_bytes());
            bmp_buf[22..26].copy_from_slice(&bmi.bi_height.to_le_bytes());
            bmp_buf[26..28].copy_from_slice(&bmi.bi_planes.to_le_bytes());
            bmp_buf[28..30].copy_from_slice(&bmi.bi_bit_count.to_le_bytes());
            bmp_buf[30..34].copy_from_slice(&bmi.bi_compression.to_le_bytes());
            bmp_buf[34..38].copy_from_slice(&(image_size as u32).to_le_bytes());

            if lines <= 0 {
                return None;
            }

            Some(format!("data:image/bmp;base64,{}", encode_base64(&bmp_buf)))
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::encode_base64;
    use std::process::Command;

    pub fn capture_screen_data_url(_max_width: i32) -> Option<String> {
        let tmp = std::env::temp_dir().join("pomodoro_cap_tmp.jpg");
        let status = Command::new("screencapture")
            .args(["-x", "-t", "jpg"])
            .arg(&tmp)
            .status()
            .ok()?;
        if !status.success() {
            return None;
        }
        let bytes = std::fs::read(&tmp).ok()?;
        let _ = std::fs::remove_file(&tmp);
        Some(format!("data:image/jpeg;base64,{}", encode_base64(&bytes)))
    }
}

#[cfg(target_os = "linux")]
mod platform {
    pub fn capture_screen_data_url(_max_width: i32) -> Option<String> {
        None
    }
}
