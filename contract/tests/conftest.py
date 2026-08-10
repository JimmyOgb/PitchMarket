"""Windows compatibility for the installed gltest direct-mode loader.

The gltest 0.29.2 loader duplicates a temporary file onto fd 0 and then
unlinks the file immediately. Windows keeps the duplicated handle open, so
the unlink raises WinError 32 before the contract module can be imported.
Keep the file until VMContext restores fd 0 instead.
"""

import os
import tempfile
from pathlib import Path

if os.name == "nt":
    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    if not getattr(loader, "_pitchmarket_windows_patch", False):
        original_cleanup = VMContext._cleanup_after_deactivate
        original_value_property = VMContext.value

        def cleanup_after_deactivate(self):
            original_cleanup(self)
            for path in getattr(self, "_pitchmarket_stdin_temp_paths", []):
                try:
                    Path(path).unlink()
                except FileNotFoundError:
                    pass
                except OSError:
                    # Cleanup must not hide the actual test result.
                    pass
            self._pitchmarket_stdin_temp_paths = []

        def inject_message_to_fd0(vm):
            from genlayer.py import calldata
            from genlayer.py.types import Address

            sender_addr = vm.sender
            if isinstance(sender_addr, bytes):
                sender_addr = Address(sender_addr)
            contract_addr = vm._contract_address
            if isinstance(contract_addr, bytes):
                contract_addr = Address(contract_addr)
            origin_addr = vm.origin
            if isinstance(origin_addr, bytes):
                origin_addr = Address(origin_addr)

            message_data = {
                "contract_address": contract_addr,
                "sender_address": sender_addr,
                "origin_address": origin_addr,
                "stack": [],
                "value": vm._value,
                "datetime": vm._datetime,
                "is_init": False,
                "chain_id": vm._chain_id,
                "entry_kind": 0,
                "entry_data": b"",
                "entry_stage_data": None,
            }
            encoded = calldata.encode(message_data)
            fd, path = tempfile.mkstemp()
            try:
                os.write(fd, encoded)
                os.lseek(fd, 0, os.SEEK_SET)
                vm._original_stdin_fd = os.dup(0)
                os.dup2(fd, 0)
                vm._pitchmarket_stdin_temp_paths = getattr(
                    vm, "_pitchmarket_stdin_temp_paths", []
                )
                vm._pitchmarket_stdin_temp_paths.append(path)
            except Exception:
                os.close(fd)
                Path(path).unlink(missing_ok=True)
                raise
            else:
                os.close(fd)

        def set_value_with_payable_balance(vm, value):
            original_value_property.fset(vm, value)
            if value and vm._contract_address is not None:
                address = vm._to_bytes(vm._contract_address)
                vm._balances[address] = vm._balances.get(address, 0) + value

        VMContext._cleanup_after_deactivate = cleanup_after_deactivate
        loader._inject_message_to_fd0 = inject_message_to_fd0
        VMContext.value = property(original_value_property.fget, set_value_with_payable_balance)
        loader._pitchmarket_windows_patch = True
