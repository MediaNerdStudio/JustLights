cmake_minimum_required(VERSION 3.24)
project(JustLights VERSION 0.1.5 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Widgets Network HttpServer WebSockets SerialPort WebEngineWidgets)

qt_add_executable(JustLights
    src/main.cpp
    src/assets.qrc
    src/core/Universe.cpp
    src/core/Universe.h
    src/engine/EffectEngine.cpp
    src/engine/EffectEngine.h
    src/plugins/ArtNetOutput.cpp
    src/plugins/ArtNetOutput.h
    src/plugins/SacnOutput.cpp
    src/plugins/SacnOutput.h
    src/plugins/UsbDmxOutput.cpp
    src/plugins/UsbDmxOutput.h
    src/server/ControlServer.cpp
    src/server/ControlServer.h
    src/server/OscControl.cpp
    src/server/OscControl.h
    src/server/TcpJsonControl.cpp
    src/server/TcpJsonControl.h
    src/server/RtpMidiControl.cpp
    src/server/RtpMidiControl.h
)

target_include_directories(JustLights PRIVATE src)

target_link_libraries(JustLights PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Network
    Qt6::HttpServer
    Qt6::WebSockets
    Qt6::SerialPort
    Qt6::WebEngineWidgets
)

if(WIN32)
    target_sources(JustLights PRIVATE src/JustLights.rc)
    target_link_libraries(JustLights PRIVATE winmm)
endif()

if(APPLE)
    set_source_files_properties(assets/icons/JustLights.icns PROPERTIES MACOSX_PACKAGE_LOCATION "Resources")
    target_sources(JustLights PRIVATE assets/icons/JustLights.icns)
endif()

target_compile_definitions(JustLights PRIVATE
    LIGHTCONTROLLER_VERSION="${PROJECT_VERSION}"
    LIGHTCONTROLLER_UI_DIR="${CMAKE_SOURCE_DIR}/ui/dist"
    LIGHTCONTROLLER_OFL_DIR="${CMAKE_SOURCE_DIR}/ofl"
    LIGHTCONTROLLER_PROJECTS_DIR="${CMAKE_SOURCE_DIR}/projects"
)

set_target_properties(JustLights PROPERTIES
    WIN32_EXECUTABLE TRUE
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_ICON_FILE JustLights.icns
)

install(TARGETS JustLights RUNTIME DESTINATION bin BUNDLE DESTINATION .)
install(DIRECTORY ui/dist/ DESTINATION share/JustLights/ui OPTIONAL)
