use image::{Rgba, RgbaImage};
use renart_lib::capture::{local_point, MonitorInfo, Selection};
use renart_lib::capture_session::{
    build_complete_payload, build_overlay_url, cursor_for_mode, frame_bytes_with, should_force_crosshair, OverlayCursor, UiRect, overlay_label, replace_session, validate_mode, BeginGuard, take_session, CaptureSession, SessionState, DENIED_ERROR,
    EVENT_ACTIVE_MONITOR, EVENT_CAPTURE_CANCELLED, EVENT_CAPTURE_COMPLETE, EVENT_OVERLAY_MODE,
};
use renart_lib::permissions::{allowed_with, ensure_screen_recording};
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
    assert_eq!(EVENT_ACTIVE_MONITOR, "overlay-active-monitor");
}

#[test]
fn test_denied_permission_maps_to_error_code() {
    assert_eq!(ensure_screen_recording(false), Err(DENIED_ERROR.to_string()));
    assert_eq!(DENIED_ERROR, "screen-recording-denied");
    assert!(ensure_screen_recording(true).is_ok());
}

#[test]
fn test_build_overlay_url_has_id_and_mode() {
    assert_eq!(build_overlay_url(3, "fullscreen"), "index.html?overlay=3&mode=fullscreen");
    assert_eq!(build_overlay_url(0, "region"), "index.html?overlay=0&mode=region");
}

#[test]
fn test_validate_mode_accepts_only_region_and_fullscreen() {
    assert!(validate_mode("region").is_ok());
    assert!(validate_mode("fullscreen").is_ok());
    assert!(validate_mode("window").is_err());
    assert!(validate_mode("").is_err());
}

// ---- Correções da revisão final ----

#[test]
fn test_begin_guard_blocks_a_second_start_until_the_first_is_released() {
    let guard = BeginGuard::default();
    assert!(!guard.is_busy());
    let first = guard.try_acquire();
    assert!(first.is_some());
    assert!(guard.is_busy());
    assert!(guard.try_acquire().is_none(), "segunda captura iniciando ao mesmo tempo deve ser ignorada");
    drop(first);
    assert!(!guard.is_busy());
    assert!(guard.try_acquire().is_some());
}

#[test]
fn test_frame_bytes_are_built_outside_the_session_lock() {
    let state: SessionState = SessionState::default();
    replace_session(&state, sample_session());
    let out = frame_bytes_with(&state, 1, |frame| {
        assert!(state.try_lock().is_ok(), "o Mutex não pode ficar preso enquanto o quadro é convertido");
        Ok(format!("{}x{}", frame.width(), frame.height()).into_bytes())
    })
    .unwrap();
    assert_eq!(out, b"100x100".to_vec());
}

#[test]
fn test_frame_bytes_without_session_or_with_unknown_id_is_an_error() {
    let empty: SessionState = SessionState::default();
    assert!(frame_bytes_with(&empty, 1, |_| Ok(Vec::new())).is_err());
    let state: SessionState = SessionState::default();
    replace_session(&state, sample_session());
    assert!(frame_bytes_with(&state, 99, |_| Ok(Vec::new())).is_err());
}

#[test]
fn test_each_session_has_its_own_generation() {
    let a = sample_session();
    let b = sample_session();
    assert_ne!(a.generation(), b.generation(), "o rastreador do cursor precisa distinguir sessões");
}

#[test]
fn test_overlays_start_hidden_and_the_cursor_tracker_follows_the_mouse() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/capture_session.rs")).unwrap();
    assert!(src.contains(".visible(false)"), "overlay só aparece quando o quadro está pronto");
    assert!(src.contains("overlay_ready"), "comando que mostra o overlay depois do quadro decodificado");
    assert!(src.contains("accept_first_mouse(true)"), "o primeiro clique no overlay não pode ser perdido");
    assert!(src.contains("EVENT_ACTIVE_MONITOR"), "avisa os overlays qual monitor está sob o cursor");
    assert!(src.contains("set_focus"), "o foco acompanha o monitor sob o cursor");
}

#[test]
fn test_permission_is_requested_only_when_preflight_fails() {
    use std::cell::Cell;
    let requested = Cell::new(0);
    assert!(allowed_with(|| true, || { requested.set(requested.get() + 1); false }));
    assert_eq!(requested.get(), 0, "com a permissão já concedida não deve pedir de novo");

    assert!(!allowed_with(|| false, || { requested.set(requested.get() + 1); false }));
    assert_eq!(requested.get(), 1, "sem permissão deve pedir ao sistema (abre o diálogo e lista o app)");
}

#[test]
fn test_closing_an_overlay_ends_the_session_and_brings_the_main_window_back() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/capture_session.rs")).unwrap();
    assert!(src.contains("CloseRequested"), "overlay fechado pelo sistema deve encerrar a captura");
}

#[test]
fn test_global_shortcut_does_not_touch_the_main_window_while_a_capture_is_starting() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/shortcuts.rs")).unwrap();
    let busy = src.find("is_busy").expect("atalho deve checar BeginGuard::is_busy");
    let show = src.find(".show()").expect("atalho mostra a janela principal");
    assert!(busy < show, "a checagem de captura em andamento vem antes de mostrar a janela");
}

// ---- Cursor de mira e modo mutável ----

#[test]
fn test_session_mode_can_change_when_the_user_switches_between_area_and_full_screen() {
    let mut s = sample_session();
    assert_eq!(s.mode(), "region");
    s.set_mode("fullscreen".to_string());
    assert_eq!(s.mode(), "fullscreen");
}

#[test]
fn test_crosshair_cursor_only_in_region_mode() {
    assert_eq!(cursor_for_mode("region"), OverlayCursor::Crosshair);
    assert_eq!(cursor_for_mode("fullscreen"), OverlayCursor::Default);
    assert_eq!(cursor_for_mode("qualquer"), OverlayCursor::Default);
}

#[test]
fn test_cursor_tracker_forces_the_system_cursor_on_the_main_thread() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/capture_session.rs")).unwrap();
    assert!(src.contains("run_on_main_thread"), "NSCursor só pode ser alterado na thread principal");
    assert!(src.contains("apply_overlay_cursor"), "o rastreador reaplica o cursor a cada tick");
    assert!(src.contains("set_mode"), "set_overlay_mode atualiza o modo da sessão para o rastreador");
}

// ---- Cursor sobre a barra de opções ----

#[test]
fn test_ui_rect_contains_points_inside_and_respects_the_margin() {
    let bar = UiRect { x: 400.0, y: 20.0, width: 300.0, height: 40.0 };
    assert!(bar.contains(500.0, 30.0, 0.0));
    assert!(bar.contains(400.0, 20.0, 0.0), "a borda de início pertence à barra");
    assert!(!bar.contains(700.0, 30.0, 0.0), "a borda de fim não pertence");
    assert!(!bar.contains(395.0, 30.0, 0.0));
    assert!(bar.contains(395.0, 30.0, 6.0), "a margem evita o pisca-pisca na borda da barra");
    assert!(!bar.contains(500.0, 200.0, 6.0));
}

#[test]
fn test_crosshair_is_not_forced_over_the_options_bar() {
    assert!(should_force_crosshair("region", false));
    assert!(!should_force_crosshair("region", true), "sobre a barra a página decide o cursor");
    assert!(!should_force_crosshair("fullscreen", false));
}

#[test]
fn test_local_point_is_relative_to_the_monitor_origin_even_when_negative() {
    let m = MonitorInfo { id: 3, name: "E".into(), x: -1920, y: -200, width: 1920, height: 1080, scale_factor: 1.0, is_primary: false };
    assert_eq!(local_point(&m, -1900.0, -180.0), (20.0, 20.0));
    assert_eq!(monitor(1, 100, 100, 1.0).x, 0);
    assert_eq!(local_point(&monitor(1, 100, 100, 1.0), 40.0, 50.0), (40.0, 50.0));
}

#[test]
fn test_session_stores_the_options_bar_rect_per_monitor() {
    let mut s = sample_session();
    assert!(s.ui_rect(1).is_none());
    s.set_ui_rect(1, UiRect { x: 1.0, y: 2.0, width: 3.0, height: 4.0 }).unwrap();
    assert_eq!(s.ui_rect(1), Some(UiRect { x: 1.0, y: 2.0, width: 3.0, height: 4.0 }));
    assert!(s.ui_rect(2).is_none());
    assert!(s.set_ui_rect(99, UiRect { x: 0.0, y: 0.0, width: 1.0, height: 1.0 }).is_err());
}

#[test]
fn test_cursor_tracker_leaves_the_cursor_to_the_page_over_the_bar() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/capture_session.rs")).unwrap();
    assert!(src.contains("should_force_crosshair"), "o rastreador só força a mira fora da barra");
    assert!(src.contains("set_overlay_ui_rect"), "comando que recebe o retângulo da barra");
}

// ---- Resultado da captura: PNG codificado uma única vez, clipboard direto da imagem ----

#[test]
fn test_complete_payload_encodes_once_and_copies_the_raw_image() {
    use std::cell::Cell;
    let img = RgbaImage::from_pixel(8, 4, Rgba([1, 2, 3, 255]));
    let encodes = Cell::new(0);
    let copied_size = Cell::new((0, 0));
    let payload = build_complete_payload(
        &img,
        true,
        |i| {
            copied_size.set(i.dimensions());
            Ok(())
        },
        |i| {
            encodes.set(encodes.get() + 1);
            renart_lib::capture::image_to_png_bytes(i)
        },
    )
    .unwrap();
    assert_eq!(encodes.get(), 1, "o PNG deve ser codificado uma única vez");
    assert_eq!(copied_size.get(), (8, 4), "o clipboard recebe a imagem crua, sem passar por PNG");
    assert!(payload.fullscreen);
    assert!(payload.data_url.starts_with("data:image/png;base64,"));
}

#[test]
fn test_clipboard_failure_does_not_block_the_capture_result() {
    let img = RgbaImage::from_pixel(2, 2, Rgba([9, 9, 9, 255]));
    let payload = build_complete_payload(&img, false, |_| Err("sem clipboard".into()), |i| {
        renart_lib::capture::image_to_png_bytes(i)
    })
    .unwrap();
    assert!(!payload.fullscreen);
}

#[test]
fn test_encode_failure_is_reported() {
    let img = RgbaImage::from_pixel(2, 2, Rgba([9, 9, 9, 255]));
    assert!(build_complete_payload(&img, false, |_| Ok(()), |_| Err("falha".into())).is_err());
}
