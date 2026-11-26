package com.flexclubmanagement.gateway.config;

import org.testcontainers.containers.JdbcDatabaseContainer;

public interface SqlTestContainer {
    JdbcDatabaseContainer<?> getTestContainer();
}
