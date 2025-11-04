# ⚠️ Disclaimer: Software Under Development ⚠️


This software is currently under **active development** and has not been audited for security or correctness.

## ZisK Distributed Console

This is a **fork** of the original [ZisK repository](https://github.com/0xPolygonHermez/zisk) with additional features focused on distributed proof generation and monitoring.

## What's Different in This Fork
This fork extends the original ZisK codebase with a comprehensive distributed proof generation system for a ** Fluent Distributed proof generation UI and monitoring dashboard**:

 
### New Features

  
1.  **Distributed Proof Generation Dashboard** (`distributed-console/`)
- Real-time web-based monitoring interface built with React, TypeScript, and Tailwind CSS
- Proof generation timeline visualization
- REST-to-gRPC gateway server for connecting the dashboard to the coordinator
- Auto-discovery of active proof jobs

2.  **Enhanced Distributed System** (`distributed/`)

- Coordinator service for managing distributed proof generation
- Worker nodes for parallel proof computation
- gRPC API for communication between components
- Job management and worker pool coordination

  
### Getting Started with the Dashboard

The distributed console dashboard allows you to monitor and manage distributed proof generation.
<img width="1208" height="741" alt="Screenshot 2025-11-04 at 9 02 51 PM" src="https://github.com/user-attachments/assets/9ff3e377-804d-4bcc-8165-0fe99f9737d7" />

  

Quick start:

```bash
cd  distributed-console
npm  install
npm  run  dev
```
<img width="1216" height="678" alt="Screenshot 2025-11-04 at 8 06 37 PM" src="https://github.com/user-attachments/assets/f01dacdf-f565-4f18-965f-37fa0489a27c" />


  
## Original ZisK
ZisK is an innovative and high-performance zkVM (Zero-Knowledge Virtual Machine) developed by Polygon that enables trustless, verifiable computation, allowing developers to generate and verify proofs for arbitrary program execution efficiently.

  

ZisK aims to provide a flexible and developer-friendly zkVM, with Rust as its primary language for writing provable programs, with planned support for other languages in the future. By abstracting complex zero-knowledge proof generation, ZisK simplifies the integration of ZK technology into scalable, private, and secure applications across blockchain ecosystems and beyond.

  

**Original Repository**: [0xPolygonHermez/zisk](https://github.com/0xPolygonHermez/zisk)

  

## Getting Started

  

To start using ZisK, follow the [Quickstart](https://0xpolygonhermez.github.io/zisk/getting_started/quickstart.html) guide.

  

📚 Complete Documentation: [ZisK Docs](https://0xpolygonhermez.github.io/zisk/)

  

## License

  

All crates in this monorepo are licensed under one of the following options:

  

- The Apache License, Version 2.0 (see LICENSE-APACHE or http://www.apache.org/licenses/LICENSE-2.0)

  

- The MIT License (see LICENSE-MIT or http://opensource.org/licenses/MIT)

  

You may choose either license at your discretion.

  

## Acknowledgements

  

This fork is based on the original ZisK project, which is a collaborative effort made possible by the contributions of researchers, engineers, and developers dedicated to advancing zero-knowledge technology.

  

We extend our gratitude to the [Polygon zkEVM](https://github.com/0xpolygonhermez) and [Plonky3](https://github.com/Plonky3/Plonky3) teams for their foundational work in zero-knowledge proving systems, as well as to the [RISC-V](https://github.com/riscv) community for providing a robust architecture that enables the zkVM model.

  

Additionally, we acknowledge the efforts of the open-source cryptography and ZK research communities, whose insights and contributions continue to shape the evolution of efficient and scalable zero-knowledge technologies.

  

🚀 Special thanks to all contributors who have helped develop, refine, and improve ZisK!
