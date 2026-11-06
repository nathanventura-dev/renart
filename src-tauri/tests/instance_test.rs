// src-tauri/tests/instance_test.rs

#[test]
fn test_instance_counter_limit_allows_two_instances() {
    let mut tracker = renart_lib::instance::InstanceCounter::new(2);

    // 1ª instância registra-se com sucesso
    assert_eq!(tracker.register_instance(1001), Ok(1));
    assert_eq!(tracker.active_count(), 1);

    // 2ª instância registra-se com sucesso
    assert_eq!(tracker.register_instance(1002), Ok(2));
    assert_eq!(tracker.active_count(), 2);

    // 3ª instância é rejeitada pelo limite máximo de 2
    let third = tracker.register_instance(1003);
    assert!(third.is_err());
    assert_eq!(third.unwrap_err(), "Limite máximo de 2 instâncias atingido");
}

#[test]
fn test_instance_release_frees_slot_for_new_instance() {
    let mut tracker = renart_lib::instance::InstanceCounter::new(2);

    tracker.register_instance(2001).unwrap();
    tracker.register_instance(2002).unwrap();
    assert_eq!(tracker.active_count(), 2);

    // Finaliza uma instância existente
    tracker.release_instance(2001);
    assert_eq!(tracker.active_count(), 1);

    // Agora uma nova instância (PID 2003) deve ser aceita
    assert_eq!(tracker.register_instance(2003), Ok(2));
    assert_eq!(tracker.active_count(), 2);
}

#[test]
fn test_instance_duplicate_pid_is_idempotent() {
    let mut tracker = renart_lib::instance::InstanceCounter::new(2);

    assert_eq!(tracker.register_instance(3001), Ok(1));
    // Mesmo PID não deve contar como nova instância
    assert_eq!(tracker.register_instance(3001), Ok(1));
    assert_eq!(tracker.active_count(), 1);
}
