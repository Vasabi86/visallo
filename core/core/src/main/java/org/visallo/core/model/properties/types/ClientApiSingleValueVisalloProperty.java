package org.visallo.core.model.properties.types;

import org.visallo.core.util.ClientApiConverter;

public abstract class ClientApiSingleValueVisalloProperty<TClientApi> extends SingleValueVisalloProperty<TClientApi, String> {
    private final Class<TClientApi> clazz;

    public ClientApiSingleValueVisalloProperty(String key, Class<TClientApi> clazz) {
        super(key);
        this.clazz = clazz;
    }

    @Override
    public String wrap(TClientApi value) {
        return ClientApiConverter.clientApiToString(value);
    }

    @Override
    public TClientApi unwrap(Object value) {
        if (value == null) {
            return null;
        }
        String valueStr;
        if (value instanceof String) {
            valueStr = (String) value;
        } else {
            valueStr = value.toString();
        }
        return ClientApiConverter.toClientApi(valueStr, clazz);
    }
}

