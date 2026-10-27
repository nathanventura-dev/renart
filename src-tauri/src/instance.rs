use std::collections::HashSet;
use std::sync::{Arc, Mutex};

/// Controlador de contagem de instâncias simultâneas da aplicação.
#[derive(Debug, Clone)]
pub struct InstanceCounter {
    max_instances: usize,
    active_pids: HashSet<u32>,
}

impl InstanceCounter {
    pub fn new(max_instances: usize) -> Self {
        Self {
            max_instances,
            active_pids: HashSet::new(),
        }
    }

    /// Tenta registrar um novo PID de instância.
    /// Retorna a quantidade de instâncias ativas ou Erro se ultrapassar o limite.
    pub fn register_instance(&mut self, pid: u32) -> Result<usize, String> {
        if self.active_pids.contains(&pid) {
            return Ok(self.active_pids.len());
        }

        if self.active_pids.len() >= self.max_instances {
            return Err(format!("Limite máximo de {} instâncias atingido", self.max_instances));
        }

        self.active_pids.insert(pid);
        Ok(self.active_pids.len())
    }

    /// Remove o PID da contagem ativa quando a janela/instância é fechada.
    pub fn release_instance(&mut self, pid: u32) {
        self.active_pids.remove(&pid);
    }

    /// Retorna o número atual de instâncias em execução.
    pub fn active_count(&self) -> usize {
        self.active_pids.len()
    }
}

/// Estado global encapsulado em Mutex para segurança em threads concorrentes.
pub struct GlobalInstanceTracker {
    inner: Arc<Mutex<InstanceCounter>>,
}

impl GlobalInstanceTracker {
    pub fn new(max_instances: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(InstanceCounter::new(max_instances))),
        }
    }

    pub fn register_current(&self) -> Result<usize, String> {
        let pid = std::process::id();
        let mut guard = self.inner.lock().map_err(|e| format!("Falha ao travar mutex: {}", e))?;
        guard.register_instance(pid)
    }

    pub fn release_current(&self) {
        let pid = std::process::id();
        if let Ok(mut guard) = self.inner.lock() {
            guard.release_instance(pid);
        }
    }
}
