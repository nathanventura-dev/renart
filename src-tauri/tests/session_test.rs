use image::{Rgba, RgbaImage};
use renart_lib::capture::{MonitorInfo, Selection};
use renart_lib::capture_session::{
    overlay_label, replace_session, take_session, CaptureSession, SessionState, DENIED_ERROR,
    EVENT_CAPTURE_CANCELLED, EVENT_CAPTURE_COMPLETE, EVENT_OVERLAY_MODE,
};
use renart_lib::permissions::ensure_screen_recording;
use std::collections::HashMap;

fn monitor(id: u32, w: u32, h: u32, scale: f32) -> MonitorInfo {
    MonitorInfo {
        id,
        name: format!("M{id}"),
        x: 0,
        y: 0,
        width: w,
        height: h,
        scale_factor: scale,
        is_primary: id == 1,
    }
}

/// Monitor 1: 1x, quadro 100x100 vermelho. Monitor 2: 2x, lógico 200x200, quadro 400x400 azul.
fn sample_session() -> CaptureSession {
    let mut frames = HashMap::new();
    frames.insert(1, RgbaImage::from_pixel(100, 100, Rgba([255, 0, 0, 255])));
    frames.insert(2, RgbaImage::from_pixel(400, 400, Rgba([0, 0, 255, 255])));
    CaptureSession::new(
        "region".to_string(),
        vec![monitor(1, 100, 100, 1.0), monitor(2, 200, 200, 2.0)],
        frames,
    )
}

#[test]
fn test_session_returns_frame_and_monitor_by_id() {
    let s = sample_session();
    assert_eq!(s.mode(), "region");
    assert_eq!(s.monitor(2).unwrap().width, 200);
    assert_eq!(s.frame(2).unwrap().dimensions(), (400, 400));
}

#[test]
fn test_unknown_id_is_an_error() {
    let s = sample_session();
    let err = s.frame(99).unwrap_err();
    assert!(err.contains("99"), "a mensagem deve citar o id: {err}");
    assert!(s.monitor(99).is_err());
    assert!(s.crop(99, &Selection::Fullscreen).is_err());
}

#[test]
fn test_crop_uses_each_monitors_own_ratio() {
    let s = sample_session();
    let r1 = s.crop(1, &Selection::Region { x: 10.0, y: 10.0, width: 20.0, height: 30.0 }).unwrap();
    assert_eq!(r1.dimensions(), (20, 30));
    assert_eq!(*r1.get_pixel(0, 0), Rgba([255, 0, 0, 255]));

    let r2 = s.crop(2, &Selection::Region { x: 10.0, y: 10.0, width: 20.0, height: 30.0 }).unwrap();
    assert_eq!(r2.dimensions(), (40, 60));
    assert_eq!(*r2.get_pixel(0, 0), Rgba([0, 0, 255, 255]));
}

#[test]
fn test_crop_fullscreen_returns_whole_frame() {
    let s = sample_session();
    assert_eq!(s.crop(2, &Selection::Fullscreen).unwrap().dimensions(), (400, 400));
}

#[test]
fn test_replace_session_returns_previous_one() {
    let state: SessionState = SessionState::default();
    assert!(replace_session(&state, sample_session()).is_none());
    assert!(replace_session(&state, sample_session()).is_some());
    assert!(take_session(&state).is_some());
    assert!(take_session(&state).is_none());
}

#[test]
fn test_overlay_label_format() {
    assert_eq!(overlay_label(3), "capture-overlay-3");
}

#[test]
fn test_event_names_match_the_frontend_contract() {
    assert_eq!(EVENT_CAPTURE_COMPLETE, "capture-complete");
    assert_eq!(EVENT_CAPTURE_CANCELLED, "capture-cancelled");
    assert_eq!(EVENT_OVERLAY_MODE, "overlay-mode-changed");
}

#[test]
fn test_denied_permission_maps_to_error_code() {
    assert_eq!(ensure_screen_recording(false), Err(DENIED_ERROR.to_string()));
    assert_eq!(DENIED_ERROR, "screen-recording-denied");
    assert!(ensure_screen_recording(true).is_ok());
}
