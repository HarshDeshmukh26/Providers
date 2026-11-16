"""Build an offline fixture wheel using only Python's standard library."""
from pathlib import Path
from zipfile import ZipFile


def build_wheel(wheel_directory, config_settings=None, metadata_directory=None):
    name = "fragai_stdio_fixture-0.0.1-py3-none-any.whl"
    info = "fragai_stdio_fixture-0.0.1.dist-info"
    with ZipFile(Path(wheel_directory) / name, "w") as wheel:
        wheel.write(Path(__file__).parent / "server.py", "fragai_fixture.py")
        wheel.writestr(f"{info}/METADATA", "Metadata-Version: 2.1\nName: fragai-stdio-fixture\nVersion: 0.0.1\n")
        wheel.writestr(f"{info}/WHEEL", "Wheel-Version: 1.0\nGenerator: fragai-test\nRoot-Is-Purelib: true\nTag: py3-none-any\n")
        wheel.writestr(f"{info}/entry_points.txt", "[console_scripts]\nfragai-fixture = fragai_fixture:main\n")
        wheel.writestr(f"{info}/RECORD", "")
    return name
